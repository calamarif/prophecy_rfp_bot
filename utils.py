# utils.py
import re
from typing import List

def chunk_text(text: str, max_chunk_size: int = 2000, overlap: int = 200) -> List[str]:
    """
    Split `text` into overlapping chunks that try to respect sentence boundaries.

    Args:
        text: the input text
        max_chunk_size: maximum number of characters per chunk
        overlap: number of characters to overlap between adjacent chunks

    Returns:
        list of string chunks
    """
    if not text:
        return []

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()

    chunks: List[str] = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + max_chunk_size, text_len)
        chunk = text[start:end]

        # If we're not at the end, try to expand backwards to the last sentence boundary
        if end < text_len:
            # find the last period or newline in the chunk to avoid breaking sentences
            brk = max(chunk.rfind('. '), chunk.rfind('\n'))
            if brk != -1 and brk > max(0, len(chunk) - int(max_chunk_size * 0.5)):
                chunk = chunk[:brk+1]
                end = start + len(chunk)

        chunks.append(chunk.strip())

        if end >= text_len:
            break

        # advance with overlap
        start = max(0, end - overlap)

    return chunks
