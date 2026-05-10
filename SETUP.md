# Audiobook stack setup

## Architecture

- **Frontend:** Next.js on Vercel. Set `NEXT_PUBLIC_BACKEND_URL` to your public API URL (HTTPS). This is the browser-facing backend base URL (same value as `BACKEND_URL` in deployment notes).
- **Backend:** FastAPI behind Nginx, Gunicorn + `UvicornWorker`, Redis, **piper-tts** ([OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl)), ffmpeg.

## Server packages (Ubuntu-style)

```bash
sudo apt update
sudo apt install -y python3.12-venv redis-server nginx ffmpeg ufw
```

Or run `./install-piper-vps.sh` on Linux for ffmpeg + Python (see script header).

## Piper (`piper-tts`) + voices

TTS uses **`piper-tts`** from [piper1-gpl](https://github.com/OHF-Voice/piper1-gpl). On first API start, **4 voices** are downloaded from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) into `backend/app/static/voices/<voice_id>/` (each folder has `.onnx`, `.onnx.json`, and `sample.mp3`):

- **English (US)** — 2 (`en_US-ryan-high`, `en_US-ljspeech-high`)
- **English (GB)** — 2 (`en_GB-cori-high`, `en_GB-southern_english_female-low`)

First startup can take several minutes (large ONNX files). Ensure enough disk space (~1 GB+).

Smoke test after `pip install -r requirements.txt`:

```bash
cd backend && source .venv/bin/activate
python -c "from app.services.voice_assets import ensure_all_voices; ensure_all_voices()"
```

## Backend deploy

```bash
sudo mkdir -p /opt/audiobook && sudo chown $USER:$USER /opt/audiobook
cp -r backend /opt/audiobook/backend
cd /opt/audiobook
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Create `/opt/audiobook/backend/.env`:

```env
# DB index 14 = audiobook-only keys when sharing Redis with other apps
REDIS_URL=redis://127.0.0.1:6379/14
STORAGE_ROOT=/tmp/audiobooks
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

Optional: set `VOICES_BASE_DIR` in `.env` if you store voices elsewhere (see `app/config.py`).

Install systemd unit from `deploy/audiobook-backend.service` (adjust `User`, paths). Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now audiobook-backend
```

## Nginx + firewall

- Copy `deploy/nginx.conf.snippet` into your site config; set `server_name` and TLS as needed (Certbot).
- UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp   # if using HTTPS
sudo ufw enable
```

## Redis

```bash
sudo systemctl enable --now redis-server
```

If your distro uses `redis` instead of `redis-server`, swap the unit name in `deploy/audiobook-backend.service` (`Requires=` / `After=`).

## Vercel (frontend)

In the repo `frontend/`:

```bash
npm install
npm run build
```

Project settings → Environment variables:

- `NEXT_PUBLIC_BACKEND_URL` = `https://your.domain` (Nginx public URL, **no** trailing slash)

Redeploy. Mixed content: the API must be HTTPS if the site is HTTPS.

## Local dev

Terminal 1 — Redis + backend:

```bash
redis-server
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 — frontend:

```bash
cd frontend && cp .env.example .env.local
# edit NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
npm install && npm run dev
```

## Job lifecycle

- Uploads and outputs live under `/tmp/audiobooks/{job_id}/`.
- APScheduler runs every **15 minutes** and deletes job dirs older than **30 minutes**; Redis keys for those jobs are removed.
- Frontend shows a **30-minute** download warning to match.
