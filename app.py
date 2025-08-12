# app.py
import os
import json
import tempfile
from pathlib import Path
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
load_dotenv()

# RAG + embeddings imports
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

# optional LLM libs
import openai
try:
    from llama_cpp import Llama
    LLAMA_AVAILABLE = True
except Exception:
    LLAMA_AVAILABLE = False

# other
import pandas as pd

# -------- CONFIG --------
BASE_DIR = Path(__file__).parent
VECTORSTORE_DIR = BASE_DIR / "vectorstore"
METADATA_FN = VECTORSTORE_DIR / "metadata.json"
FAISS_INDEX_FN = VECTORSTORE_DIR / "faiss.index"
IDS_FN = VECTORSTORE_DIR / "ids.json"

EMBED_MODEL_NAME = os.environ.get("EMBED_MODEL_NAME", "all-MiniLM-L6-v2")
TOP_K_DEFAULT = int(os.environ.get("TOP_K_DEFAULT", 3))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
API_KEY = os.environ.get("API_KEY")  # simple header-based auth
LLAMA_MODEL_PATH = os.environ.get("LLAMA_MODEL_PATH")
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"   # Vite output by default

if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

# -------- LOAD VECTORSTORE --------
if not FAISS_INDEX_FN.exists() or not METADATA_FN.exists() or not IDS_FN.exists():
    print("WARNING: vectorstore missing; run init_ingest.py first to create vectorstore/")
    # we still continue so app can serve frontend; but /ask will fail fast

embed_model = SentenceTransformer(EMBED_MODEL_NAME) if FAISS_INDEX_FN.exists() else None
index = faiss.read_index(str(FAISS_INDEX_FN)) if FAISS_INDEX_FN.exists() else None
with open(METADATA_FN, "r", encoding="utf-8") as f:
    metadata = json.load(f) if METADATA_FN.exists() else {}
with open(IDS_FN, "r", encoding="utf-8") as f:
    IDS = json.load(f) if IDS_FN.exists() else []

# -------- LLM INIT --------
llama = None
if LLAMA_AVAILABLE and LLAMA_MODEL_PATH:
    try:
        llama = Llama(model_path=LLAMA_MODEL_PATH)
        print("Initialized llama-cpp local LLM")
    except Exception as e:
        print("Failed to init llama-cpp:", e)
        llama = None

# -------- HELPERS --------
def require_api_key(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        key = request.headers.get("X-API-KEY") or request.args.get("api_key")
        if not API_KEY or key != API_KEY:
            return jsonify({"error": "unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper

def embed_text(text: str):
    v = embed_model.encode([text], convert_to_numpy=True)
    v = v.astype("float32")
    faiss.normalize_L2(v)
    return v

def retrieve(question: str, top_k: int = TOP_K_DEFAULT):
    if index is None:
        return []
    qvec = embed_text(question)
    D, I = index.search(qvec, top_k)
    res = []
    for idx, score in zip(I[0], D[0]):
        if idx < 0 or idx >= len(IDS):
            continue
        doc_id = IDS[idx]
        meta = metadata.get(doc_id, {})
        res.append({
            "id": doc_id,
            "score": float(score),
            "source": meta.get("source"),
            "chunk_index": meta.get("chunk_index"),
            "text": meta.get("text")
        })
    return res

def strip_inline_refs(text: str):
    # remove inline markers like [1], [2] but keep bracketed text that looks like citations? we remove only numeric markers.
    import re
    return re.sub(r"\s*\[\d+\]\s*", " ", text)

def dedupe_refs(refs):
    seen = set()
    out = []
    for r in refs:
        if r not in seen:
            out.append(r)
            seen.add(r)
    return out

def call_openai(system_prompt, user_prompt):
    # modern OpenAI python SDK (>=1.0.0)
    resp = openai.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role":"system","content":system_prompt},{"role":"user","content":user_prompt}],
        temperature=0.0,
        max_tokens=800
    )
    return resp.choices[0].message.content

def call_llama(prompt):
    # llama-cpp-python modern call: llama(prompt, ...)
    out = llama(prompt, max_tokens=512, temperature=0.0)
    # structure: out['choices'][0]['text']
    return out["choices"][0]["text"] if isinstance(out, dict) and "choices" in out else str(out)

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
        "Do NOT include inline citations like [1], [2], etc. "
        "At the end include a References block listing each source and its number."
    )

    user_prompt = (
        f"Question: {question}\n\n"
        f"Context:\n{context}\n\n"
        "Provide a concise, helpful answer WITHOUT inline citations. "
        "If the context doesn't contain an answer say so clearly and do not hallucinate.\n\n"
        f"References:\n{ref_block}"
    )

    # ... rest of your LLM call logic unchanged ...

    # Prefer OpenAI
    if OPENAI_API_KEY:
        try:
            text = call_openai(system_prompt, user_prompt)
            # strip duplicate inline refs from returned text, but we will keep the references block separately
            cleaned = strip_inline_refs(text)
            return cleaned, ref_map
        except Exception as e:
            print("OpenAI call failed:", e)

    # Next prefer llama
    if llama is not None:
        try:
            txt = call_llama(system_prompt + "\n\n" + user_prompt)
            cleaned = strip_inline_refs(txt)
            return cleaned, ref_map
        except Exception as e:
            print("llama-cpp call failed:", e)

    # Fallback: return concatenated retrieved texts (no LLM)
    texts = "\n\n".join([r["text"] for r in retrieved])
    return texts, ref_map

# -------- FLASK APP --------
app = Flask(__name__, static_folder=str(FRONTEND_DIST), static_url_path='/')
# single server: frontend dist served from frontend/dist

@app.route("/ask", methods=["POST"])
@require_api_key
def ask():
    payload = request.get_json(force=True)
    q = payload.get("question")
    top_k = int(payload.get("top_k", TOP_K_DEFAULT))
    if not q:
        return jsonify({"error":"question required"}), 400
    retrieved = retrieve(q, top_k=top_k)
    answer_text, ref_map = call_llm_with_citations(q, retrieved)
    # dedupe references (mapping strings)
    refs = dedupe_refs(ref_map)
    return jsonify({
        "question": q,
        "answer": answer_text,
        "references": refs,
        "sources": [{"source": r["source"], "chunk_index": r.get("chunk_index"), "score": r["score"]} for r in retrieved]
    })

@app.route("/upload_excel", methods=["POST"])
@require_api_key
def upload_excel():
    if "file" not in request.files:
        return jsonify({"error":"file required"}), 400
    f = request.files["file"]
    suffix = Path(f.filename).suffix.lower()
    try:
        if suffix in [".xlsx", ".xls"]:
            df = pd.read_excel(f)
        else:
            df = pd.read_csv(f)
    except Exception as e:
        return jsonify({"error": f"failed to read file: {e}"}), 400
    if "question" not in df.columns:
        # allow first column as fallback
        if df.shape[1] >= 1:
            questions = df.iloc[:,0].astype(str).fillna("").tolist()
        else:
            return jsonify({"error":"input file must contain a 'question' column or at least one column"}), 400
    else:
        questions = df["question"].astype(str).fillna("").tolist()

    out_rows = []
    for q in questions:
        if not q.strip():
            out_rows.append({"question": q, "answer": ""})
            continue
        retrieved = retrieve(q, top_k=3)
        ans, refs = call_llm_with_citations(q, retrieved)
        refs = dedupe_refs(refs)
        out_rows.append({"question": q, "answer": ans, "references": refs})
    return jsonify({"results": out_rows})

# Serve frontend (Vite build goes to frontend/dist)
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # if requesting a static asset (css/js), serve it, otherwise index.html
    if path != "" and (FRONTEND_DIST / path).exists():
        return send_from_directory(str(FRONTEND_DIST), path)
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return send_from_directory(str(FRONTEND_DIST), "index.html")
    return jsonify({"msg":"Frontend not built. Run `cd frontend && npm run build`"}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
