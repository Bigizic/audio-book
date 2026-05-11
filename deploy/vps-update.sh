#!/usr/bin/env bash
# Run on the VPS after `git pull` (manually or from CI over SSH).
# Installs/updates Python deps, then restarts the backend unit.
#
# Usage (as a user who can sudo systemctl and write the venv):
#   sudo -E ./deploy/vps-update.sh
#
# Optional env:
#   DEPLOY_ROOT=/opt/audiobook          # repo root (contains backend/)
#   VENV_PYTHON=/opt/audiobook/venv/bin/python
#   SYSTEMD_UNIT=audiobook-backend

set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/audiobook}"
VENV_PYTHON="${VENV_PYTHON:-${DEPLOY_ROOT}/venv/bin/python}"
REQ="${DEPLOY_ROOT}/backend/requirements.txt"
UNIT="${SYSTEMD_UNIT:-audiobook-backend}"

if [[ ! -f "$REQ" ]]; then
  echo "Missing $REQ — set DEPLOY_ROOT?" >&2
  exit 1
fi
if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing venv at $VENV_PYTHON — create with: python3 -m venv ${DEPLOY_ROOT}/venv" >&2
  exit 1
fi

echo ">>> pip install -r backend/requirements.txt"
"$VENV_PYTHON" -m pip install -r "$REQ"

echo ">>> systemctl restart $UNIT"
systemctl restart "$UNIT"
systemctl --no-pager -l status "$UNIT" || true

echo ">>> done"
