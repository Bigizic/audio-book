"""User-requested cancellation for in-flight conversion (cooperative, between chunks)."""

from __future__ import annotations

from app.models.schemas import JobStatus
from app.services.job_store import job_store


class JobCancelled(Exception):
    """Raised when ``cancel_requested`` is set; status in Redis is already ``cancelled``."""


def abort_if_cancelled(job_id: str) -> None:
    data = job_store.get(job_id)
    if not data or not data.get("cancel_requested"):
        return
    job_store.update(
        job_id,
        status=JobStatus.cancelled.value,
        message="Cancelled.",
        error=None,
        progress_phase=None,
        eta_seconds=None,
        partial_wav_bytes=None,
        cancel_requested=False,
        mp3_path=None,
        mp3_size_bytes=None,
    )
    raise JobCancelled()
