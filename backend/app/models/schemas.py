from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    pending = "pending"
    extracting = "extracting"
    processing = "processing"
    complete = "complete"
    failed = "failed"
    cancelled = "cancelled"


class UploadResponse(BaseModel):
    job_id: str
    page_count: int
    filename: str


class ConvertRequest(BaseModel):
    job_id: str
    voice_id: str
    start_page: int = Field(ge=1)
    end_page: int = Field(ge=1)


class VoiceListItem(BaseModel):
    voice_id: str
    language_code: str
    language_label: str
    label: str
    sample_url: str


class StatusResponse(BaseModel):
    status: JobStatus
    message: str
    progress_percent: Optional[float] = None
    eta_seconds: Optional[int] = None
    mp3_size_bytes: Optional[int] = None
    """Growing ``merged.wav`` size (bytes) while synthesizing if append mode is on; None otherwise."""
    partial_wav_bytes: Optional[int] = None
    progress_phase: Optional[str] = None
    current_page: Optional[int] = None
    pages_in_job: Optional[int] = None
    pages_done: Optional[int] = None
    words_done: Optional[int] = None
    words_total: Optional[int] = None
    tts_chunk_index: Optional[int] = None
    tts_chunks_on_page: Optional[int] = None


class ConvertResponse(BaseModel):
    ok: bool = True
    job_id: str
    job_ttl_seconds: int


class FeaturesResponse(BaseModel):
    job_sse_enabled: bool
    tts_append_wav_to_output: bool = True
    job_ttl_seconds: int = 30 * 60
