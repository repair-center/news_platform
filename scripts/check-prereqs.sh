#!/usr/bin/env bash
# macOS/Linux read-only prerequisite check.
for c in node npm git psql; do command -v "$c" >/dev/null && echo "[OK] $c: $($c --version | head -1)" || echo "[MISSING] $c"; done
[ -f "$(dirname "$0")/../.env" ] && echo "[OK] .env exists" || echo "[MISSING] .env (cp .env.example .env)"
