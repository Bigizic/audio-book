import re
from pathlib import Path

import fitz  # PyMuPDF

from app.services.memory_debug import log_process_rss


def count_pages(pdf_path: Path) -> int:
    log_process_rss("pdf.count_pages", "before open")
    with fitz.open(pdf_path) as doc:
        n = len(doc)
        log_process_rss("pdf.count_pages", f"opened n={n}")
    log_process_rss("pdf.count_pages", "after close")
    return n


def split_page_for_tts(text: str, max_words: int) -> list[str]:
    """
    One PDF page → one or more Piper-sized chunks.
    Oversized pages split on paragraphs, then sentences, then hard word boundaries.
    """
    log_process_rss("pdf.split_page_for_tts", f"in chars={len(text or '')}")
    if max_words < 1:
        max_words = 1
    text = (text or "").strip()
    if not text:
        log_process_rss("pdf.split_page_for_tts", "out empty")
        return []
    words = text.split()
    if len(words) <= max_words:
        log_process_rss("pdf.split_page_for_tts", "out single chunk")
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
    out = [c for c in chunks if c.strip()]
    log_process_rss("pdf.split_page_for_tts", f"out chunks={len(out)}")
    return out


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
