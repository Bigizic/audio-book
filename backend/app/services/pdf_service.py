import re
from pathlib import Path

import fitz  # PyMuPDF


def count_pages(pdf_path: Path) -> int:
    with fitz.open(pdf_path) as doc:
        return len(doc)


def split_page_for_tts(text: str, max_words: int) -> list[str]:
    """
    One PDF page → one or more Piper-sized chunks.
    Oversized pages split on paragraphs, then sentences, then hard word boundaries.
    """
    if max_words < 1:
        max_words = 1
    text = (text or "").strip()
    if not text:
        return []
    words = text.split()
    if len(words) <= max_words:
        return [text]

    chunks: list[str] = []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    buf: list[str] = []

    def flush_buf() -> None:
        if buf:
            chunks.append(" ".join(buf))
            buf.clear()

    for para in paragraphs:
        pw = para.split()
        if len(pw) > max_words:
            flush_buf()
            chunks.extend(_split_oversized_paragraph(para, max_words))
            continue
        if len(buf) + len(pw) <= max_words:
            buf.extend(pw)
        else:
            flush_buf()
            if len(pw) <= max_words:
                buf.extend(pw)
            else:
                chunks.extend(_split_oversized_paragraph(para, max_words))
    flush_buf()
    return [c for c in chunks if c.strip()]


def _split_oversized_paragraph(para: str, max_words: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+|\n+", para)
    out: list[str] = []
    buf: list[str] = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        sw = s.split()
        if len(buf) + len(sw) <= max_words:
            buf.extend(sw)
        else:
            if buf:
                out.append(" ".join(buf))
                buf = []
            if len(sw) <= max_words:
                buf.extend(sw)
            else:
                for i in range(0, len(sw), max_words):
                    out.append(" ".join(sw[i : i + max_words]))
    if buf:
        out.append(" ".join(buf))
    return out
