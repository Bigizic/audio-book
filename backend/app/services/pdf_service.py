from pathlib import Path

import pdfplumber

from app.config import settings


def count_pages(pdf_path: Path) -> int:
    with pdfplumber.open(pdf_path) as pdf:
        return len(pdf.pages)


def extract_text_range(pdf_path: Path, start_page: int, end_page: int) -> tuple[str, int]:
    """
    start_page, end_page are 1-based inclusive, clamped to document.
    Returns (text, pages_used).
    """
    with pdfplumber.open(pdf_path) as pdf:
        n = len(pdf.pages)
        start = max(1, start_page)
        end = min(end_page, n)
        if start > end:
            return "", 0
        parts: list[str] = []
        for idx in range(start - 1, end):
            page = pdf.pages[idx]
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t.strip())
        return "\n\n".join(parts), end - start + 1


def chunk_text(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text else []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            split_at = text.rfind("\n\n", start, end)
            if split_at == -1 or split_at <= start:
                split_at = text.rfind(" ", start, end)
            if split_at > start:
                end = split_at
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end
    return chunks
