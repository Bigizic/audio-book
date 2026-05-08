#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  [[ -n "${BACKEND_PID}" ]] && kill "${BACKEND_PID}" 2>/dev/null || true
  [[ -n "${FRONTEND_PID}" ]] && kill "${FRONTEND_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! redis-cli ping >/dev/null 2>&1; then
  echo "Warning: Redis not reachable (redis-cli ping failed). Start redis-server first." >&2
fi

# Backend
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi
# shellcheck source=/dev/null
source "$ROOT/backend/.venv/bin/activate"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
echo "Backend http://127.0.0.1:8000 (pid $BACKEND_PID)"

sleep 1

# Frontend
cd "$ROOT/frontend"
if [[ ! -f .env.local ]]; then
  echo "NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000" > .env.local
fi
if [[ ! -d node_modules ]]; then
  npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "Frontend http://localhost:3000 (pid $FRONTEND_PID)"
echo "Ctrl+C stops both."

wait "${FRONTEND_PID}"
