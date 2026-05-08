from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import redis

from app.config import settings
from app.models.schemas import JobStatus


def _key(job_id: str) -> str:
    return f"job:{job_id}"


class JobStore:
    def __init__(self) -> None:
        self._r = redis.from_url(settings.redis_url, decode_responses=True)

    def create_job(
        self,
        pdf_path: Path,
        original_filename: str,
        page_count: int,
        job_id: str | None = None,
    ) -> str:
        job_id = job_id or str(uuid.uuid4())
        data: dict[str, Any] = {
            "job_id": job_id,
            "status": JobStatus.pending.value,
            "message": "Uploaded. Ready to convert.",
            "pdf_path": str(pdf_path),
            "original_filename": original_filename,
            "page_count": page_count,
            "mp3_path": None,
            "error": None,
            "created_at": time.time(),
            "progress_percent": 0.0,
            "eta_seconds": None,
            "char_count": 0,
            "mp3_size_bytes": None,
        }
        self._r.set(_key(job_id), json.dumps(data), ex=settings.job_ttl_seconds + 3600)
        return job_id

    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        raw = self._r.get(_key(job_id))
        if not raw:
            return None
        return json.loads(raw)

    def update(self, job_id: str, **fields: Any) -> None:
        data = self.get(job_id)
        if not data:
            return
        data.update({k: v for k, v in fields.items() if v is not None})
        self._r.set(_key(job_id), json.dumps(data), ex=settings.job_ttl_seconds + 3600)

    def touch_ttl(self, job_id: str) -> None:
        raw = self._r.get(_key(job_id))
        if raw:
            self._r.set(_key(job_id), raw, ex=settings.job_ttl_seconds + 3600)

    def delete(self, job_id: str) -> None:
        self._r.delete(_key(job_id))


job_store = JobStore()
