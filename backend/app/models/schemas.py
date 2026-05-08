from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    pending = "pending"
    extracting = "extracting"
    processing = "processing"
    complete = "complete"
    failed = "failed"


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
