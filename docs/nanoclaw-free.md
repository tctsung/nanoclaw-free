# NanoClaw Free

Run NanoClaw on a free OpenCode model — no Anthropic/Claude account.

## What it is

One free provider (OpenCode Zen), one API key in `.env`, driven through the
**unmodified** upstream `nanoclaw.sh`. No multi-provider failover, no vault key
registration — the smallest thing that works.

## Setup

1. Get a free key at <https://opencode.ai/auth>.
2. `bash setup-free.sh` — seeds `.env`, prompts you to paste the key, then runs
   the full install (Docker, OneCLI, container build, channel pairing).

The wrapper sets `NANOCLAW_PICKED_PROVIDER=opencode` and skips the Claude
sign-in step. OneCLI still installs (the container spawn gate requires it), but
the model key is passed straight to OpenCode, not through the vault.

## How the key reaches the model (the fix)

Stock `/add-opencode` sends `apiKey: 'placeholder'` and trusts the OneCLI proxy
to swap in the real key by host-match. For OpenCode Zen — which needs the
`x-api-key` header, not `Authorization: Bearer` — that swap fails with "invalid
api key". The free baseline instead passes the real `OPENCODE_API_KEY` into the
container and adds the provider host (from `ANTHROPIC_BASE_URL`) to `NO_PROXY`,
so OpenCode authenticates the provider directly with its own correct header.
Without a key set, behaviour is unchanged (placeholder + proxy — the
Anthropic-via-vault path).

Patched: `src/providers/opencode.ts` (host: forward key + NO_PROXY host),
`container/agent-runner/src/providers/opencode.ts` (`buildOpenCodeConfig`: real
key over placeholder).

## Smoke test (run on the Mac — can't be verified without keys + Docker)

The logic above is unit-checked, but the credential round-trip only runs with a
real key, Docker, and the toolchain. After setup:

1. `pnpm run build && pnpm exec tsc -p container/agent-runner/tsconfig.json --noEmit`
2. `cd container/agent-runner && bun install && bun test src/providers/ && cd -`
3. `./container/build.sh`
4. DM the Telegram bot "hi" → expect a real model reply (NOT "invalid api key").
5. If it 401s: `logs/nanoclaw.error.log`, confirm `OPENCODE_API_KEY` is set, and
   that `NO_PROXY` inside the container includes `opencode.ai`
   (`docker exec <container> printenv NO_PROXY`).

## Deferred on purpose (YAGNI)

Multi-provider failover (primary→fallback on 429) is **not** built. A single
free provider has to work end-to-end first. Add it only when one model's rate
limit is a measured, recurring problem — then a fallback model id + a retry
loop around the provider's `query()`, not a general ordered-list framework.
