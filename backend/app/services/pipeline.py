import shutil
import time
from pathlib import Path

import fitz

from app.config import settings
from app.models.schemas import JobStatus
from app.services.job_cancel import JobCancelled, abort_if_cancelled
from app.services.job_store import job_store
from app.services.memory_debug import log_process_rss
from app.services.audiobook_alignment import (
    measure_chunk_silence_ms,
    wav_duration_ms,
    write_alignment_file,
)
from app.services.pdf_service import split_page_for_tts
from app.services.ffmpeg_audio import concat_wavs, wav_to_mp3
from app.services.tts_service import run_piper_wav

MERGED_WAV_NAME = "merged.wav"
_CHUNK_WAV_NAME = "_chunk.wav"


def _estimate_eta_seconds(char_count: int, num_segments: int) -> int:
    base = 15 + num_segments * 8
    return int(base + max(0, char_count) / 400)


def _append_chunk_to_merged(work: Path, merged_path: Path, chunk_path: Path, job_id: str) -> None:
    if not merged_path.is_file():
        shutil.copy2(chunk_path, merged_path)
    else:
        next_m = work / "_merged_next.wav"
        concat_wavs([merged_path, chunk_path], next_m)
        merged_path.unlink(missing_ok=True)
        next_m.rename(merged_path)
    job_store.update(
        job_id,
        partial_wav_bytes=merged_path.stat().st_size,
    )


def process_conversion(job_id: str, start_page: int, end_page: int, voice_id: str) -> None:
    data = job_store.get(job_id)
    if not data:
        return
    pdf_path = Path(data["pdf_path"])
    work = settings.storage_root / job_id
    work.mkdir(parents=True, exist_ok=True)
    max_words = settings.tts_max_words_per_chunk
    append_mode = settings.tts_append_wav_to_output
    merged_path = work / MERGED_WAV_NAME
    chunk_path = work / _CHUNK_WAV_NAME

    try:
        merged_path.unlink(missing_ok=True)
        chunk_path.unlink(missing_ok=True)
        job_store.update(job_id, partial_wav_bytes=None)

        pages_in_job = end_page - start_page + 1
        words_done = 0
        total_chars = 0
        wav_segments: list[Path] = []
        seg_idx = 0
        pages_completed = 0
        alignment_segments: list[dict] = []

        job_store.update(
            job_id,
            status=JobStatus.extracting.value,
            progress_phase="reading",
            message="Opening PDF…",
            progress_percent=2.0,
            pages_in_job=pages_in_job,
            pages_done=0,
            words_done=0,
            words_total=None,
            current_page=start_page,
            tts_chunk_index=None,
            tts_chunks_on_page=None,
        )

        abort_if_cancelled(job_id)

        with fitz.open(pdf_path) as doc:
            n_doc = len(doc)
            if start_page > n_doc:
                raise ValueError("Start page is past the end of the document.")

            last_page_idx = min(end_page, n_doc)
            page_indices = list(range(start_page - 1, last_page_idx))

            job_store.update(
                job_id,
                progress_phase="reading",
                message=f"Scanning {len(page_indices)} page(s) for word count…",
                progress_percent=1.0,
            )

            page_texts: list[str] = []
            for p_idx in page_indices:
                abort_if_cancelled(job_id)
                text = (doc[p_idx].get_text() or "").strip()
                page_texts.append(text)
                page_num = p_idx + 1
                log_process_rss(
                    "pdf.prescan_get_text",
                    f"page={page_num} chars={len(text)}",
                )

            words_total = sum(len(t.split()) if t else 0 for t in page_texts)
            job_store.update(
                job_id,
                words_total=words_total,
                words_done=0,
                message=(
                    f"Found {words_total:,} words in {len(page_indices)} page(s). Starting audio…"
                    if words_total
                    else f"No text found in {len(page_indices)} page(s)."
                ),
                progress_percent=2.0,
            )

            abort_if_cancelled(job_id)

            for i, p_idx in enumerate(page_indices):
                abort_if_cancelled(job_id)
                page_num = p_idx + 1
                rel = page_num - start_page

                job_store.update(
                    job_id,
                    status=JobStatus.extracting.value,
                    progress_phase="reading",
                    current_page=page_num,
                    pages_in_job=pages_in_job,
                    pages_done=pages_completed,
                    words_done=words_done,
                    message=f"Reading page {page_num} of {n_doc}…",
                    progress_percent=2.0 + 10.0 * rel / max(1, pages_in_job),
                )

                text = page_texts[i]
                log_process_rss(
                    "pdf.page_reuse_text",
                    f"page={page_num} chars={len(text)}",
                )
                page_words = len(text.split()) if text else 0
                words_done += page_words
                total_chars += len(text)
                job_store.update(job_id, words_done=words_done)

                subchunks = split_page_for_tts(text, max_words)
                log_process_rss(
                    "pdf.after_split_page",
                    f"page={page_num} chunks={len(subchunks)}",
                )

                job_store.update(
                    job_id,
                    status=JobStatus.processing.value,
                    progress_phase="synthesizing",
                    current_page=page_num,
                    pages_in_job=pages_in_job,
                    pages_done=pages_completed,
                    words_done=words_done,
                    tts_chunks_on_page=len(subchunks) if subchunks else 0,
                    tts_chunk_index=0,
                    message=(
                        f"Synthesizing page {page_num}…"
                        if subchunks
                        else f"No text on page {page_num}, skipping."
                    ),
                    progress_percent=12.0 + 75.0 * rel / max(1, pages_in_job),
                    char_count=total_chars,
                    eta_seconds=max(10, int(35 * (pages_in_job - pages_completed))),
                )

                if not subchunks:
                    pages_completed += 1
                    continue

                k = len(subchunks)
                rough_segments = seg_idx + k + max(1, pages_in_job - pages_completed) * 2
                eta_base = _estimate_eta_seconds(total_chars, rough_segments)

                for j, chunk in enumerate(subchunks):
                    abort_if_cancelled(job_id)
                    if append_mode:
                        run_piper_wav(chunk, chunk_path, voice_id)
                        dur_ms = wav_duration_ms(chunk_path)
                        lead_ms, trail_ms = measure_chunk_silence_ms(chunk_path)
                        alignment_segments.append(
                            {
                                "page": page_num,
                                "text": chunk,
                                "duration_ms": dur_ms,
                                "lead_silence_ms": lead_ms,
                                "trail_silence_ms": trail_ms,
                            }
                        )
                        _append_chunk_to_merged(work, merged_path, chunk_path, job_id)
                        chunk_path.unlink(missing_ok=True)
                    else:
                        out = work / f"seg_{seg_idx:04d}.wav"
                        run_piper_wav(chunk, out, voice_id)
                        dur_ms = wav_duration_ms(out)
                        lead_ms, trail_ms = measure_chunk_silence_ms(out)
                        alignment_segments.append(
                            {
                                "page": page_num,
                                "text": chunk,
                                "duration_ms": dur_ms,
                                "lead_silence_ms": lead_ms,
                                "trail_silence_ms": trail_ms,
                            }
                        )
                        wav_segments.append(out)
                        seg_idx += 1
                    done_sub = j + 1
                    frac_page = done_sub / k
                    pct = 12.0 + 75.0 * ((pages_completed + frac_page) / max(1, pages_in_job))
                    remaining_pages = pages_in_job - pages_completed - frac_page
                    job_store.update(
                        job_id,
                        progress_percent=min(91.0, pct),
                        tts_chunk_index=done_sub,
                        tts_chunks_on_page=k,
                        message=f"Synthesizing page {page_num}, part {done_sub}/{k}…",
                        eta_seconds=max(
                            5,
                            int(eta_base * remaining_pages / max(1, pages_in_job)),
                        ),
                    )

                abort_if_cancelled(job_id)
                pages_completed += 1

        abort_if_cancelled(job_id)

        if append_mode:
            if not merged_path.is_file():
                raise ValueError("No extractable text in the selected page range.")
            merged = merged_path
        else:
            if not wav_segments:
                raise ValueError("No extractable text in the selected page range.")
            merged = work / MERGED_WAV_NAME
            concat_wavs(wav_segments, merged)
            for p in wav_segments:
                p.unlink(missing_ok=True)

        write_alignment_file(work, job_id, alignment_segments)

        mp3_path = work / "output.mp3"
        job_store.update(
            job_id,
            progress_phase="encoding",
            message="Encoding MP3…",
            progress_percent=92.0,
            tts_chunk_index=None,
            tts_chunks_on_page=None,
            partial_wav_bytes=None,
        )
        abort_if_cancelled(job_id)
        wav_to_mp3(merged, mp3_path)
        merged.unlink(missing_ok=True)

        size = mp3_path.stat().st_size
        job_store.update(
            job_id,
            status=JobStatus.complete.value,
            progress_phase=None,
            message="Ready to download.",
            progress_percent=100.0,
            mp3_path=str(mp3_path),
            eta_seconds=0,
            mp3_size_bytes=size,
            current_page=None,
            partial_wav_bytes=None,
        )
    except JobCancelled:
        pass
    except Exception as e:
        job_store.update(
            job_id,
            status=JobStatus.failed.value,
            progress_phase=None,
            message=str(e),
            error=str(e),
            eta_seconds=None,
            partial_wav_bytes=None,
        )
    finally:
        job_store.touch_ttl(job_id)


def cleanup_old_files() -> None:
    root = settings.storage_root
    if not root.exists():
        return
    cutoff = time.time() - settings.job_ttl_seconds
    for p in root.iterdir():
        if not p.is_dir():
            continue
        try:
            mtime = p.stat().st_mtime
        except OSError:
            continue
        if mtime < cutoff:
            shutil.rmtree(p, ignore_errors=True)
            job_store.delete(p.name)
