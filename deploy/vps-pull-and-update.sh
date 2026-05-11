#!/usr/bin/env bash
# Git + pip + systemd restart. Intended to run as root (e.g. sudo from the app user).
# Requires: git repo at DEPLOY_ROOT writable by this user; venv at ${DEPLOY_ROOT}/venv.
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/audiobook}"
cd "$DEPLOY_ROOT"

echo ">>> git fetch origin main"
git fetch origin main

echo ">>> git reset --hard origin/main"
git reset --hard origin/main

export DEPLOY_ROOT
exec bash "$DEPLOY_ROOT/deploy/vps-update.sh"
