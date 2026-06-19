#!/usr/bin/env bash
#
# setup-free.sh — "always free" NanoClaw setup wrapper (no Claude account).
#
# Drives the UNMODIFIED upstream nanoclaw.sh via env vars: preselects the
# OpenCode provider and skips the Claude sign-in + the claude-based timezone
# step. The model API key lives in .env (OPENCODE_API_KEY) and is passed
# straight to OpenCode — no vault key registration. OneCLI still installs
# (every container spawns through its gateway) but isn't in the key path.
#
# Usage:  bash setup-free.sh    (free key: https://opencode.ai/auth)

set -euo pipefail
cd "$(dirname "$0")"

# First run: seed .env from the example so the model is configured out of the box.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — add your OPENCODE_API_KEY and TELEGRAM_BOT_TOKEN, then re-run."
  exit 0
fi

# Load .env so the model selection + key reach setup and the host.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Pick OpenCode without tripping upstream's setup-provider registry (it only
# knows claude/codex): skip `auth` and set NANOCLAW_PICKED_PROVIDER, which
# init-{cli,first}-agent write into the agent's container config. Skip
# `timezone` (a claude -p call). DO run `onecli` — the container spawn gate
# requires it.
export NANOCLAW_PICKED_PROVIDER=opencode
export NANOCLAW_SKIP="auth,timezone"
export TZ="${TZ_OVERRIDE:-${TZ:-$(cat /etc/timezone 2>/dev/null || echo UTC)}}"

if [ -z "${OPENCODE_API_KEY:-}" ]; then
  echo "WARNING: OPENCODE_API_KEY is empty in .env — the agent will get 401s."
fi

exec bash nanoclaw.sh "$@"
