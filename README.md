<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  A personal AI assistant that runs agents securely in their own containers — on a <strong>free</strong> model, no Anthropic account.
</p>

---

## What This Is

A fork of [nanocoai/nanoclaw](https://github.com/nanocoai/nanoclaw) for people who don't have — or don't want to pay for — an Anthropic API key. It swaps the original's reliance on Claude Code for a **free [OpenCode](https://opencode.ai) model**, so you can clone, run `setup-free.sh`, and have a personal AI assistant in containers with no paid account.

Everything that makes NanoClaw good is unchanged — a small, readable codebase (one process and a handful of files) and agents isolated in their own Linux containers — just without the Anthropic dependency. For the full feature set, architecture, and philosophy, see the [upstream README](https://github.com/nanocoai/nanoclaw).

## Quick Start (free — no Claude/Anthropic account)

```bash
git clone https://github.com/tctsung/nanoclaw-free.git nanoclaw
cd nanoclaw
bash setup-free.sh
```

`setup-free.sh` takes you from a fresh machine to a named agent you can message, running entirely on a **free** [OpenCode Zen](https://opencode.ai/zen/) model. It installs Node, pnpm, and Docker if missing, sets up a local OneCLI credential vault, builds the agent container, and pairs your first channel (Telegram by default; Discord, WhatsApp, or a local CLI also available). When it needs your model API key, it prompts you to paste one — get a free key at <https://opencode.ai/auth>.

The default model is `opencode/big-pickle`. Edit `OPENCODE_MODEL` (and optionally the provider / base URL) in `.env` to use any OpenCode-supported model. Full guide and troubleshooting: **[docs/nanoclaw-free.md](docs/nanoclaw-free.md)**.

> **Free-tier note:** free models are rate-limited. For a personal assistant this is usually fine; under heavy use you may hit caps. You can point `.env` at any paid OpenCode provider (OpenRouter, DeepSeek, Anthropic, …) without code changes.

Prefer the original Claude-powered setup? Use [upstream NanoClaw](https://github.com/nanocoai/nanoclaw) — this fork only removes the Anthropic dependency from the default path.

## What You Get

- **Free model backend** — OpenCode provider wired in, free OpenCode Zen model by default. Swap to any OpenCode-supported backend via `.env`.
- **Telegram** — message your agent from your phone, out of the box.
- **Container isolation** — agents are sandboxed in Docker (macOS/Linux/WSL2); they only see what you mount.
- **Local credential vault** — keys live in a local OneCLI gateway, never in chat context.
- **Scheduled tasks, web access, per-agent memory** — same as upstream NanoClaw.

## Requirements

- macOS or Linux (Windows via WSL2)
- Node.js 22 and pnpm 10+ (the installer installs both if missing)
- [Docker](https://docker.com/products/docker-desktop) with Compose ≥ 2.24
- A free OpenCode key — <https://opencode.ai/auth>

## Customizing & Docs

This fork keeps upstream's architecture intact, so its docs apply:

- **This fork's setup + troubleshooting:** [docs/nanoclaw-free.md](docs/nanoclaw-free.md)
- **Architecture, isolation model, customizing, channels:** [upstream NanoClaw](https://github.com/nanocoai/nanoclaw) and its [docs](https://docs.nanoclaw.dev)

## License

MIT

<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=47894bd5-353b-42fe-bb97-74144e6df0bf" />
