import os
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_file, abort, send_from_directory
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import openai
import tempfile
import pandas as pd
from dotenv import load_dotenv

# Optional local LLM libs
try:
    from llama_cpp import Llama
    LLM_LIB = 'llama_cpp'
except Exception:
    LLM_LIB = None

try:
    from transformers import pipeline
    TRANSFORMERS_AVAILABLE = True
except Exception:
    TRANSFORMERS_AVAILABLE = False

load_dotenv()

# Config
BASE_DIR = Path(__file__).parent
VECTORSTORE_DIR = BASE_DIR / "vectorstore"
METADATA_FN = VECTORSTORE_DIR / "metadata.json"
FAISS_INDEX_FN = VECTORSTORE_DIR / "faiss.index"
IDS_FN = VECTORSTORE_DIR / "ids.json"
EMBED_MODEL_NAME = os.environ.get("EMBED_MODEL_NAME", "all-MiniLM-L6-v2")
TOP_K_DEFAULT = int(os.environ.get("TOP_K_DEFAULT", 3))

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
API_KEY = os.environ.get("API_KEY")  # simple API key for auth
LLAMA_MODEL_PATH = os.environ.get("LLAMA_MODEL_PATH")  # if provided, use llama-cpp-python

if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

# --------------------------------
# Load embedding model and index
# --------------------------------
print("Loading embedding model...")
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

print("Loading FAISS index and metadata...")
if not FAISS_INDEX_FN.exists() or not METADATA_FN.exists() or not IDS_FN.exists():
    raise SystemExit("vectorstore missing. Run init_ingest.py first to create vectorstore/")

index = faiss.read_index(str(FAISS_INDEX_FN))
with open(METADATA_FN, "r", encoding="utf-8") as f:
    metadata = json.load(f)
with open(IDS_FN, "r", encoding="utf-8") as f:
    IDS = json.load(f)

# If llama-cpp is available and LLAMA_MODEL_PATH set, init Llama
llama = None
if LLM_LIB == 'llama_cpp' and LLAMA_MODEL_PATH:
    try:
        llama = Llama(model_path=LLAMA_MODEL_PATH)
        print("Initialized llama-cpp local LLM")
    except Exception as e:
        print("Failed to init llama-cpp:", e)
        llama = None

# If transformers available, prepare a pipeline lazy-initialized
transformer_gen = None

def ensure_transformer_pipeline():
    global transformer_gen
    if transformer_gen is None and TRANSFORMERS_AVAILABLE:
        try:
            transformer_gen = pipeline('text-generation', model=os.environ.get('HF_MODEL'), max_length=512)
            print("Initialized transformers local pipeline")
        except Exception as e:
            print("Failed to init transformers pipeline:", e)
            transformer_gen = None

# helpers

def embed_text(text: str):
    v = embed_model.encode([text], convert_to_numpy=True)
    v = v.astype("float32")
    faiss.normalize_L2(v)
    return v


def retrieve(question: str, top_k: int = TOP_K_DEFAULT):
    qvec = embed_text(question)
    D, I = index.search(qvec, top_k)
    results = []
    for idx, score in zip(I[0], D[0]):
        if idx < 0 or idx >= len(IDS):
            continue
        doc_id = IDS[idx]
        meta = metadata.get(doc_id, {})
        results.append({
            "id": doc_id,
            "score": float(score),
            "source": meta.get("source"),
            "chunk_index": meta.get("chunk_index"),
            "text": meta.get("text")
        })
    return results

# LLM orchestration: prefer OpenAI if available, else local llama-cpp, else transformers, else fallback

def call_llm_with_citations(question: str, retrieved: list):
    context_parts = []
    ref_map = []
    for i, r in enumerate(retrieved, start=1):
        label = f"[{i}]"
        context_parts.append(f"{label} Source: {r['source']}\nContent:\n{r['text']}\n")
        ref_map.append(f"{label} -> {r['source']} (chunk {r.get('chunk_index')})")

    context = "\n\n".join(context_parts)
    ref_block = "\n".join(ref_map)

    system_prompt = (
        "You are an assistant that must answer using only the provided sources. "
        "Cite sources inline using numbered markers [1], [2], etc. At the end include a References block listing each number and the full source path."
    )

    user_prompt = (
        f"Question: {question}\n\n"
        f"Context:\n{context}\n\n"
        "Provide a concise, helpful answer and cite top sources inline (e.g., [1]). "
        "If the context doesn't contain an answer say so clearly and do not hallucinate.\n\n"
        f"References:\n{ref_block}"
    )

    # 1) OpenAI
    if OPENAI_API_KEY:
        try:
            resp = openai.chat.completions.create(
                model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
                temperature=0.0,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=800
            )
            text = resp.choices[0].message.content
            return text
        except Exception as e:
            print("OpenAI call failed:", e)

    # 2) llama-cpp local
    if llama is not None:
        try:
            prompt = system_prompt + "\n\n" + user_prompt
            res = llama(prompt, max_tokens=512, temperature=0.0)

            return res['choices'][0]['text'].strip()
        except Exception as e:
            print("llama-cpp call failed:", e)

    # 3) transformers
    if TRANSFORMERS_AVAILABLE:
        try:
            ensure_transformer_pipeline()
            if transformer_gen is not None:
                prompt = system_prompt + "\n\n" + user_prompt
                out = transformer_gen(prompt, max_length=512, do_sample=False, num_return_sequences=1)
                return out[0]['generated_text']
        except Exception as e:
            print("transformers call failed:", e)

    # 4) fallback: return concatenated retrieved texts and references
    texts = "\n\n".join([r['text'] for r in retrieved])
    return f"(No LLM available) Top retrieved content:\n\n{texts}\n\nReferences:\n{ref_block}"

# Simple auth decorator
from functools import wraps

def require_api_key(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        key = None
        # accept header or query param or json field
        if 'X-API-KEY' in request.headers:
            key = request.headers.get('X-API-KEY')
        else:
            key = request.args.get('api_key') or (request.get_json(silent=True) or {}).get('api_key')
        if not API_KEY or key != API_KEY:
            return jsonify({"error": "unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper

# Flask app
from flask import Flask
app = Flask(__name__)

# Serve React build files from frontend/dist
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    dist_dir = BASE_DIR / "frontend" / "dist"
    if path != "" and (dist_dir / path).exists():
        return send_from_directory(dist_dir, path)
    else:
        return send_from_directory(dist_dir, "index.html")

@app.route('/ask', methods=['POST'])
@require_api_key
def ask():
    data = request.get_json(force=True)
    q = data.get('question')
    top_k = int(data.get('top_k', TOP_K_DEFAULT))
    if not q:
        return jsonify({'error': 'question required'}), 400
    retrieved = retrieve(q, top_k=top_k)
    answer = call_llm_with_citations(q, retrieved)
    return jsonify({
        'question': q,
        'answer': answer,
        'sources': [{'source': r['source'], 'chunk_index': r.get('chunk_index'), 'score': r['score']} for r in retrieved]
    })

@app.route('/ask_batch', methods=['POST'])
@require_api_key
def ask_batch():
    if 'file' not in request.files:
        return jsonify({'error': 'file required'}), 400
    f = request.files['file']
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=Path(f.filename).suffix)
    f.save(tmp.name)
    ext = Path(tmp.name).suffix.lower()
    if ext in ['.xlsx', '.xls']:
        df = pd.read_excel(tmp.name)
    else:
        df = pd.read_csv(tmp.name)
    if 'question' not in df.columns:
        return jsonify({'error': "input file must contain a 'question' column"}), 400

    out_rows = []
    for q in df['question'].astype(str).fillna(''):
        retrieved = retrieve(q, top_k=3)
        ans = call_llm_with_citations(q, retrieved)
        out_rows.append({'question': q, 'answer': ans, 'sources': '; '.join([r['source'] for r in retrieved])})

    out_df = pd.DataFrame(out_rows)
    out_path = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx').name
    out_df.to_excel(out_path, index=False)
    return send_file(out_path, as_attachment=True, download_name='answers.xlsx')

@app.route('/health')
def health():
    return jsonify({'ok': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5055)))
