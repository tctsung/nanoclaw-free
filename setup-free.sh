#!/usr/bin/env bash
#
# setup-free.sh — "always free" NanoClaw setup wrapper (no Claude account).
#
# Drives the UNMODIFIED upstream nanoclaw.sh via env vars: preselects the
# OpenCode provider and skips the Claude sign-in step. The model API key lives
# in .env (OPENCODE_API_KEY) and is passed straight to OpenCode — no vault key
# registration. OneCLI still installs (every container spawns through its
# gateway) but isn't in the key path.
#
# Usage:  bash setup-free.sh    (free key: https://opencode.ai/auth)

set -euo pipefail
cd "$(dirname "$0")"

# First run: seed .env from the example so the model is configured out of the box.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

# Load .env so the model selection + key reach setup and the host.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Pick OpenCode without tripping upstream's setup-provider registry (it only
# knows claude/codex): skip the `auth` step and set NANOCLAW_PICKED_PROVIDER,
# which init-{cli,first}-agent write into the agent's container config. The
# timezone step auto-detects and confirms interactively (no Claude needed for a
# normal IANA zone), so it runs unchanged. `onecli` runs too — the spawn gate
# requires it.
export NANOCLAW_PICKED_PROVIDER=opencode
export NANOCLAW_SKIP="auth"

# No key yet? Prompt for it and persist to .env — the host reads the key from
# the .env FILE at spawn time, so exporting alone won't survive into the
# service. (awk, not `sed -i`: portable across macOS/Linux.) The -t 0 guard
# turns a headless run into a clear message instead of a hang on `read`.
if [ -z "${OPENCODE_API_KEY:-}" ]; then
  [ -t 0 ] || { echo "Set OPENCODE_API_KEY in .env, then re-run."; exit 1; }
  echo "Get a free OpenCode key at https://opencode.ai/auth"
  read -rp 'Paste your OPENCODE_API_KEY: ' OPENCODE_API_KEY
  [ -n "$OPENCODE_API_KEY" ] || { echo "No key entered. Re-run when you have one."; exit 1; }
  awk -v k="$OPENCODE_API_KEY" '/^OPENCODE_API_KEY=/{print "OPENCODE_API_KEY=" k; next} {print}' .env > .env.tmp && mv .env.tmp .env
  export OPENCODE_API_KEY
fi

exec bash nanoclaw.sh "$@"
