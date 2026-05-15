from __future__ import annotations

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from app.config import settings
from app.models.schemas import (
    ConvertRequest,
    ConvertResponse,
    FeaturesResponse,
    JobStatus,
    StatusResponse,
    UploadResponse,
    VoiceListItem,
)
from app.services.job_store import job_store
from app.services.github_webhook import (
    load_webhook_secret,
    post_notify,
    run_pull_and_update,
    verify_github_signature,
)
from app.services.pdf_service import count_pages
from app.services.pipeline import MERGED_WAV_NAME, cleanup_old_files, process_conversion
from app.services.audiobook_alignment import ALIGNMENT_FILENAME
from app.services.voice_assets import ensure_all_voices, is_voice_ready, sample_mp3_path
from app.voice_catalog import sorted_voices, voice_ids


def _configure_project_logging() -> None:
    """INFO by default for root and ``app`` so project loggers are visible under uvicorn/gunicorn."""
    fmt = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setLevel(logging.INFO)
        handler.setFormatter(logging.Formatter(fmt, datefmt))
        root.addHandler(handler)
    logging.getLogger("app").setLevel(logging.INFO)


_configure_project_logging()
logger = logging.getLogger(__name__)



@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(ensure_all_voices)
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        cleanup_old_files,
        "interval",
        minutes=settings.cleanup_interval_minutes,
        id="audiobook_cleanup",
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Audiobook API", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/voices", response_model=list[VoiceListItem])
async def list_voices() -> list[VoiceListItem]:
    out: list[VoiceListItem] = []
    for v in sorted_voices():
        out.append(
            VoiceListItem(
                voice_id=v.voice_id,
                language_code=v.language_code,
                language_label=v.language_label,
                label=v.label,
                sample_url=f"/voices/{v.voice_id}/sample",
            )
        )
    return out


@app.get("/voices/{voice_id}/sample")
async def voice_sample_by_id(voice_id: str) -> FileResponse:
    if voice_id not in voice_ids():
        raise HTTPException(404, "Unknown voice.")
    if not is_voice_ready(voice_id):
        raise HTTPException(503, "Voice not ready yet.")
    path = sample_mp3_path(voice_id)
    return FileResponse(path, media_type="audio/mpeg", filename=f"{voice_id}_sample.mp3")


@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")

    job_id = str(uuid.uuid4())
    work = settings.storage_root / job_id
    work.mkdir(parents=True, exist_ok=True)
    dest = work / "input.pdf"
    try:
        content = await file.read()
        dest.write_bytes(content)
        pages = count_pages(dest)
    except Exception as e:
        raise HTTPException(400, f"Invalid PDF: {e}") from e

    job_store.create_job(dest, file.filename, pages, job_id=job_id)

    return UploadResponse(job_id=job_id, page_count=pages, filename=file.filename)


@app.post("/convert", response_model=ConvertResponse)
async def convert(
    body: ConvertRequest,
    background_tasks: BackgroundTasks,
) -> ConvertResponse:
    if body.voice_id not in voice_ids():
        raise HTTPException(400, "Invalid voice_id.")
    if not is_voice_ready(body.voice_id):
        raise HTTPException(503, "Selected voice is not available yet.")

    data = job_store.get(body.job_id)
    if not data:
        raise HTTPException(404, "Job not found.")
    if data["status"] not in (
        JobStatus.pending.value,
        JobStatus.failed.value,
        JobStatus.cancelled.value,
    ):
        if data["status"] == JobStatus.complete.value:
            raise HTTPException(400, "Already converted.")
        raise HTTPException(409, "Conversion in progress.")

    pc = int(data.get("page_count") or 0)
    if body.start_page > body.end_page:
        raise HTTPException(400, "Start page must be ≤ end page.")
    if body.end_page > pc:
        raise HTTPException(400, f"End page exceeds document ({pc} pages).")

    job_store.update(
        body.job_id,
        status=JobStatus.extracting.value,
        message="Queued...",
        progress_percent=0.0,
        error=None,
        mp3_path=None,
        mp3_size_bytes=None,
        partial_wav_bytes=None,
        progress_phase=None,
        current_page=None,
        pages_in_job=None,
        pages_done=None,
        words_done=None,
        words_total=None,
        tts_chunk_index=None,
        tts_chunks_on_page=None,
        char_count=0,
        cancel_requested=False,
    )
    background_tasks.add_task(
        process_conversion,
        body.job_id,
        body.start_page,
        body.end_page,
        body.voice_id,
    )
    return ConvertResponse(
        job_id=body.job_id,
        job_ttl_seconds=settings.job_ttl_seconds,
    )


def _status_from_job(data: dict) -> StatusResponse:
    status = JobStatus(data["status"])
    return StatusResponse(
        status=status,
        message=data.get("message") or "",
        progress_percent=data.get("progress_percent"),
        eta_seconds=data.get("eta_seconds"),
        mp3_size_bytes=data.get("mp3_size_bytes"),
        partial_wav_bytes=data.get("partial_wav_bytes"),
        progress_phase=data.get("progress_phase"),
        current_page=data.get("current_page"),
        pages_in_job=data.get("pages_in_job"),
        pages_done=data.get("pages_done"),
        words_done=data.get("words_done"),
        words_total=data.get("words_total"),
        tts_chunk_index=data.get("tts_chunk_index"),
        tts_chunks_on_page=data.get("tts_chunks_on_page"),
    )


@app.get("/features", response_model=FeaturesResponse)
async def features() -> FeaturesResponse:
    return FeaturesResponse(
        job_sse_enabled=settings.job_sse_enabled,
        tts_append_wav_to_output=settings.tts_append_wav_to_output,
        job_ttl_seconds=settings.job_ttl_seconds,
    )


@app.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict:
    """Request cooperative cancellation. Always 200: missing job is treated as already gone."""
    data = job_store.get(job_id)
    if not data:
        return {"ok": True, "detail": "not_found"}
    st = data.get("status")
    if st in (
        JobStatus.complete.value,
        JobStatus.failed.value,
        JobStatus.cancelled.value,
    ):
        return {"ok": True, "detail": "already_finished"}
    job_store.update(job_id, cancel_requested=True)
    return {"ok": True}


@app.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str) -> StatusResponse:
    data = job_store.get(job_id)
    if not data:
        raise HTTPException(404, "Job not found.")
    return _status_from_job(data)


@app.get("/status/{job_id}/stream")
async def status_stream(job_id: str) -> StreamingResponse:
    if not settings.job_sse_enabled:
        raise HTTPException(404, "Job status streaming is disabled.")

    async def event_gen():
        last: Optional[str] = None
        while True:
            data = job_store.get(job_id)
            if not data:
                yield f"data: {json.dumps({'error': 'not_found'})}\n\n"
                return
            payload = _status_from_job(data).model_dump(mode="json")
            blob = json.dumps(payload)
            if blob != last:
                last = blob
                yield f"data: {blob}\n\n"
            st = data.get("status")
            if st in (
                JobStatus.complete.value,
                JobStatus.failed.value,
                JobStatus.cancelled.value,
            ):
                return
            await asyncio.sleep(0.2)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/hooks/github/deploy", include_in_schema=False)
async def github_deploy_webhook(request: Request, background_tasks: BackgroundTasks) -> dict:
    """
    GitHub repository webhook (push). Verifies X-Hub-Signature-256, then runs
    deploy/vps-pull-and-update.sh in a background task (GitHub times out ~10s if we block).

    Configure: GITHUB_WEBHOOK_SECRET or GITHUB_WEBHOOK_SECRET_FILE, DEPLOY_ROOT, sudoers for the app user.
    Optional: DEPLOY_NOTIFY_URL (e.g. ntfy.sh) for success/failure JSON.
    """
    secret = load_webhook_secret(
        settings.github_webhook_secret,
        settings.github_webhook_secret_file,
    )
    if not secret:
        raise HTTPException(503, "GitHub webhook is not configured.")

    body = await request.body()
    sig = request.headers.get("x-hub-signature-256") or request.headers.get(
        "X-Hub-Signature-256"
    )
    if not verify_github_signature(body, sig, secret):
        raise HTTPException(400, "Invalid or missing signature.")

    event = (request.headers.get("x-github-event") or "").lower()
    if event == "ping":
        return {"ok": True, "ping": True}

    if event != "push":
        return {"ok": True, "ignored": True, "reason": f"event:{event or 'unknown'}"}

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON body.") from None

    if payload.get("ref") != "refs/heads/main":
        return {"ok": True, "ignored": True, "reason": "not main branch"}

    script = settings.deploy_pull_script
    if script is None:
        script = settings.deploy_root / "deploy" / "vps-pull-and-update.sh"
    if not script.is_file():
        raise HTTPException(500, f"Deploy script not found: {script}")

    def deploy_job() -> None:
        ok, msg = run_pull_and_update(settings.deploy_root, script)
        if settings.deploy_notify_url:
            post_notify(settings.deploy_notify_url, ok, msg)
        if ok:
            logger.info("GitHub deploy finished OK")
        else:
            logger.error("GitHub deploy failed: %s", msg)

    background_tasks.add_task(deploy_job)
    return {
        "ok": True,
        "accepted": True,
        "detail": "Deploy started in background; check logs or DEPLOY_NOTIFY_URL.",
    }


@app.get("/preview-audio/{job_id}")
async def preview_audio(job_id: str) -> FileResponse:
    """Growing WAV while conversion runs (append mode only)."""
    if not settings.tts_append_wav_to_output:
        raise HTTPException(404, "Live preview not enabled for this server.")
    data = job_store.get(job_id)
    if not data:
        raise HTTPException(404, "Job not found.")
    st = data.get("status")
    if st not in (JobStatus.extracting.value, JobStatus.processing.value):
        raise HTTPException(400, "Preview is only available during conversion.")
    path = settings.storage_root / job_id / MERGED_WAV_NAME
    if not path.is_file():
        raise HTTPException(404, "No audio yet.")
    return FileResponse(
        path,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@app.get("/audiobook-alignment/{job_id}")
async def audiobook_alignment(job_id: str) -> dict:
    """Word-level timing derived from Piper chunk WAV lengths (approximate within chunk)."""
    data = job_store.get(job_id)
    if not data:
        raise HTTPException(404, "Job not found.")
    if data["status"] != JobStatus.complete.value:
        raise HTTPException(400, "Alignment is available when the audiobook is complete.")
    path = settings.storage_root / job_id / ALIGNMENT_FILENAME
    if not path.is_file():
        raise HTTPException(404, "Alignment file missing.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(500, "Invalid alignment file.") from None


@app.get("/download/{job_id}")
async def download(job_id: str) -> FileResponse:
    data = job_store.get(job_id)
    if not data:
        raise HTTPException(404, "Job not found.")
    if data["status"] != JobStatus.complete.value:
        raise HTTPException(400, "Not ready.")
    mp3 = data.get("mp3_path")
    if not mp3:
        raise HTTPException(404, "File missing.")
    path = Path(mp3)
    if not path.is_file():
        raise HTTPException(404, "File expired or removed.")
    name = (data.get("original_filename") or "book").rsplit(".", 1)[0] + ".mp3"
    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename=name,
    )
