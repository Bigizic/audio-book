"""Optional RSS logging for the current process (PDF / TTS hotspots)."""

from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger(__name__)


def log_process_rss(label: str, detail: str = "") -> None:
    """Log current process RSS in MiB when settings.memory_usage_debug is True."""
    if not settings.memory_usage_debug:
        return
    try:
        import psutil
    except ImportError:
        logger.warning("memory_usage_debug enabled but psutil is not installed")
        return
    try:
        rss_mib = psutil.Process().memory_info().rss / (1024 * 1024)
        suffix = f" {detail}" if detail else ""
        logger.info("mem_debug [%s] RSS=%.1f MiB%s", label, rss_mib, suffix)
    except Exception as e:
        logger.warning("mem_debug [%s] failed: %s", label, e)
