import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.models.schemas import (
    ConvertRequest,
    JobStatus,
    StatusResponse,
    UploadResponse,
    VoiceListItem,
)
from app.services.job_store import job_store
from app.services.pdf_service import count_pages
from app.services.pipeline import cleanup_old_files, process_conversion
from app.services.voice_assets import ensure_all_voices, is_voice_ready, sample_mp3_path
from app.voice_catalog import VOICE_IDS, sorted_voices

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
    if voice_id not in VOICE_IDS:
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


@app.post("/convert")
async def convert(
    body: ConvertRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    if body.voice_id not in VOICE_IDS:
        raise HTTPException(400, "Invalid voice_id.")
    if not is_voice_ready(body.voice_id):
        raise HTTPException(503, "Selected voice is not available yet.")

    data = job_store.get(body.job_id)
    if not data:
        raise HTTPException(404, "Job not found.")
    if data["status"] not in (JobStatus.pending.value, JobStatus.failed.value):
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
    )
    background_tasks.add_task(
        process_conversion,
        body.job_id,
        body.start_page,
        body.end_page,
        body.voice_id,
    )
    return {"ok": True, "job_id": body.job_id}


@app.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str) -> StatusResponse:
    data = job_store.get(job_id)
    if not data:
        raise HTTPException(404, "Job not found.")
    status = JobStatus(data["status"])
    return StatusResponse(
        status=status,
        message=data.get("message") or "",
        progress_percent=data.get("progress_percent"),
        eta_seconds=data.get("eta_seconds"),
        mp3_size_bytes=data.get("mp3_size_bytes"),
    )


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
