# init_ingest.py  -- fixed & more verbose for debugging
import os
import zipfile
import uuid
import json
import tempfile
import traceback
from pathlib import Path
from typing import List, Dict, Tuple
from tqdm import tqdm

# Text extraction libs
from bs4 import BeautifulSoup
import docx
from pypdf import PdfReader

# chunk_text from utils.py (make sure utils.py is in same folder)
from utils import chunk_text

# Chunking & embedding
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

# ---------- Config ----------
CHUNK_SIZE_CHARS = 2000
CHUNK_OVERLAP = 200
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
VECTORSTORE_DIR = Path("vectorstore")
METADATA_FN = VECTORSTORE_DIR / "metadata.json"
FAISS_INDEX_FN = VECTORSTORE_DIR / "faiss.index"
IDS_FN = VECTORSTORE_DIR / "ids.json"
BATCH_SIZE = 64
# ----------------------------

def extract_text_from_docx(path: Path) -> str:
    try:
        doc = docx.Document(path)
        paragraphs = [p.text for p in doc.paragraphs]
        return "\n".join(paragraphs)
    except Exception:
        raise

def extract_text_from_html(path: Path) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        soup = BeautifulSoup(f, "html.parser")
    for s in soup(["script", "style", "noscript"]):
        s.extract()
    return soup.get_text(separator="\n")

def extract_text_from_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    pages = []
    for p_idx, p in enumerate(reader.pages):
        try:
            pages.append(p.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n\n".join(pages)

def process_file(path: Path) -> List[Dict]:
    """
    Extract text and split into chunks. Returns list of dicts with id, source, text, chunk_index.
    """
    ext = path.suffix.lower()
    try:
        if ext == ".docx":
            text = extract_text_from_docx(path)
        elif ext in [".html", ".htm"]:
            text = extract_text_from_html(path)
        elif ext == ".pdf":
            text = extract_text_from_pdf(path)
        else:
            print(f"Skipping unsupported file type: {path}")
            return []
    except Exception as e:
        print(f"[ERROR] Failed to extract {path}: {e}")
        traceback.print_exc()
        return []

    if not text or not text.strip():
        print(f"[WARN] No text extracted from {path}, skipping.")
        return []

    # Use chunk_text (from utils) and avoid name shadowing
    chunks = chunk_text(text, max_chunk_size=CHUNK_SIZE_CHARS, overlap=CHUNK_OVERLAP)
    out = []
    for i, chunk in enumerate(chunks):
        doc_id = str(uuid.uuid4())
        out.append({
            "id": doc_id,
            "source": None,  # set by caller relative to zip root
            "text": chunk,
            "chunk_index": i
        })
    return out

def ingest_zip(zip_path: str):
    VECTORSTORE_DIR.mkdir(exist_ok=True)
    tempdir = Path(tempfile.mkdtemp(prefix="kb_ingest_"))
    print(f"Extracting zip to: {tempdir}")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tempdir)

    # list files for debug
    all_paths = sorted([p for p in tempdir.rglob("*") if p.is_file()])
    print(f"Found {len(all_paths)} files in zip.")
    for p in all_paths:
        try:
            print(f" - {p.relative_to(tempdir)}  ({p.suffix.lower()}, {p.stat().st_size} bytes)")
        except Exception:
            print(f" - {p} (couldn't relpath)")

    # target extensions
    target_exts = {".docx", ".pdf", ".html", ".htm"}
    files = [p for p in all_paths if p.suffix.lower() in target_exts]
    print(f"Processing {len(files)} target files (docx/pdf/html).")

    all_chunks = []
    for p in tqdm(files, desc="Processing files"):
        items = process_file(p)
        # Save source relative to the extracted root for traceability (use os.path.relpath to be safe)
        for it in items:
            it["source"] = os.path.relpath(str(p), start=str(tempdir))
        all_chunks.extend(items)

    print(f"Total chunks created: {len(all_chunks)}")
    if not all_chunks:
        raise SystemExit("No chunks created; aborting.")

    # Embeddings
    print("Loading embedding model:", EMBED_MODEL_NAME)
    model = SentenceTransformer(EMBED_MODEL_NAME)

    embeddings = []
    ids = []
    try:
        for i in tqdm(range(0, len(all_chunks), BATCH_SIZE), desc="Embedding batches"):
            batch = all_chunks[i:i+BATCH_SIZE]
            texts = [c["text"] for c in batch]
            embs = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
            embeddings.append(embs)
            ids.extend([c["id"] for c in batch])
    except Exception as e:
        print("[ERROR] Embedding failed:", e)
        traceback.print_exc()
        raise

    embeddings = np.vstack(embeddings).astype("float32")

    # FAISS index
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    # normalize vectors to unit length for cosine similarity via inner product
    faiss.normalize_L2(embeddings)
    index.add(embeddings)
    faiss.write_index(index, str(FAISS_INDEX_FN))
    print(f"FAISS index written to {FAISS_INDEX_FN}")

    # Save metadata and ids
    meta_map = {c["id"]: {k: v for k, v in c.items() if k != "text"} for c in all_chunks}
    for mid, c in zip(ids, all_chunks):
        meta_map[mid]["text"] = c["text"]
    with open(METADATA_FN, "w", encoding="utf-8") as f:
        json.dump(meta_map, f, ensure_ascii=False, indent=2)
    with open(IDS_FN, "w", encoding="utf-8") as f:
        json.dump(ids, f, ensure_ascii=False, indent=2)

    print("Ingest complete. Vectorstore saved to:", VECTORSTORE_DIR)

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("zipfile", help="path to zip file containing docs")
    args = p.parse_args()
    ingest_zip(args.zipfile)
