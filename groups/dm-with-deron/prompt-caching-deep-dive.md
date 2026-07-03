# Prompt Caching Deep Dive

*Based on: Anthropic docs, "Prompt Caching Is Everything" (Claude blog), production guides, June 2026*

---

## 1. What It Is

Prompt caching lets the API store the **internal model state** (KV cache) for a prefix of your request and **reuse** it on subsequent calls. Instead of reprocessing the same system prompt + tools + conversation history from scratch every turn, Claude skips the prefix and only computes the new tokens.

### Pricing (vs base input)

| Operation | Cost |
|-----------|------|
| Base input | 1.0× |
| Cache write (first time) | **1.25×** (5-min TTL) / **2.0×** (1-hr TTL) |
| Cache read (subsequent hits) | **0.10×** (90% off!) |

Break-even: after **2 requests** you're saving money.

### Latency

Cache reads skip prompt processing entirely — **time-to-first-token drops 79–85%** on long contexts (reported: 1,840ms → 380ms).

---

## 2. How It Works (Mechanism)

### Prefix matching, byte-for-byte

The API hashes everything from the **start** of the request up to each `cache_control` breakpoint. The hash is **cumulative** — changing a single byte anywhere in the prefix invalidates the entire suffix.

Processing order for hashing: `tools → system → messages`

### Breakpoints (up to 4 per request)

You place `cache_control: { type: "ephemeral" }` on a content block. Everything from position 0 up to and including that block becomes a cache entry.

### Lookback window (20 blocks)

On each request the system:
1. Computes the hash at your breakpoint
2. Checks for a matching cache entry
3. If no match, walks **backward up to 20 blocks**, checking each position for a prior write
4. If found → cache hit. If not → cache write.

**Implication:** You don't need the breakpoint at the *exact same position* every time. As long as a prior request wrote a cache entry within 20 blocks behind your current breakpoint, you get a hit.

### TTL: 5 min (default) or 1 hour

- **5-min TTL**: write 1.25×, read 0.10×. Each hit refreshes the timer. Steady traffic keeps it warm indefinitely.
- **1-hr TTL**: write 2.0×, read 0.10×. Use for batch jobs, low-traffic endpoints, overnight processing. Pays for itself with ≥2 reads/hour.

### Minimum cacheable prefix

- Sonnet 4.6: **1,024 tokens**
- Haiku: **2,048 tokens**
- Opus 4.7: **4,096 tokens**

Below these thresholds, `cache_control` is **silently ignored** — no error, no discount. Always verify with `usage.cache_creation_input_tokens`.

### Workspace-level isolation

Since Feb 2026, caches are isolated **per API workspace** (not per org). Different workspaces don't share caches. Bedrock/Vertex AI use org-level isolation.

### New tokenizer (Opus 4.7+)

Opus 4.7 uses a new tokenizer that can produce **up to 35% more tokens** for the same text. Re-baseline token counts if switching from Sonnet.

---

## 3. How to Apply Properly

### A. Layout: static first, dynamic last

```
[tools — deterministic order]         ← breakpoint 1
[system prompt — no timestamps]       ← breakpoint 2
[static documents / CLAUDE.md]        ← breakpoint 3
[conversation history]                ← breakpoint 4 (auto-advancing)
[per-request content — user message]  ← NOT cached
```

### B. Automatic vs explicit caching

| Approach | How | Best for |
|----------|-----|----------|
| **Automatic** | Add `cache_control` at top level of request body | Multi-turn chat — system auto-places breakpoint on the last block and moves it forward as the conversation grows |
| **Explicit** | Place `cache_control` on individual blocks | Fine-grained control, different caching cadences per section |

### C. Use messages, not system prompt edits

When context changes (time, user action, file edit), don't rewrite the system prompt — that invalidates the entire cache. Instead:

- Append a `<system-reminder>` tag in the **next user message** or **tool result**
- The cached prefix stays intact; only new tokens are processed

### D. Never add/remove tools mid-session

Tools are part of the cached prefix. Changing the tool set = cache miss for the entire conversation.

**Pattern: Plan Mode** — Claude Code keeps ALL tools in every request, and uses `EnterPlanMode` / `ExitPlanMode` as tools the model calls. Tool definitions never change.

**Pattern: `defer_loading`** — Instead of removing tools, send lightweight stubs (name only, `defer_loading: true`). Full schemas load only when the model selects the tool via tool search.

### E. Don't switch models mid-session

Caches are model-specific. Switching from Opus (100k tokens deep) to Haiku for a "simple" question is actually **more expensive** — the Haiku cache is empty and must be rebuilt from scratch.

Instead, use **subagents** for model switching (e.g., Opus prepares a handoff message for a Haiku subagent).

### F. Cache-safe compaction

Compaction (summarization to free context) is a cost trap:

- **Wrong:** Separate API call with different system prompt → no cache match → pay full uncached rate for the entire long conversation
- **Right:** Use the **exact same** system prompt, tools, and conversation prefix, then append the compaction prompt as a new user message at the end → the cached prefix is reused

The API now has built-in [compaction support](https://platform.claude.com/docs/en/build-with-claude/compaction) that handles this.

---

## 4. Traps & Silent Killers

### Cache hit = zero but no error

If `cache_read_input_tokens` is consistently 0 across repeated requests, something is silently changing the prefix:

1. **Timestamps in system prompt** — `"Today is 2026-06-25"` breaks cache next day
2. **UUIDs / request IDs / session IDs** in cached blocks
3. **Non-deterministic JSON serialization** — Go, Swift, etc. don't guarantee key order
4. **Shuffled tool order** — sort tools deterministically
5. **Whitespace differences** — trailing spaces, newline changes
6. **Model parameter changes** — enabling/disabling extended thinking changes the prefix

### Below minimum token threshold

Block is too short (< 1,024 for Sonnet) → `cache_control` silently ignored. Always verify.

### One-hour TTL overuse

If traffic is steady (requests every < 5 min), the 5-min TTL stays warm perpetually. Using 1-hour TTL means paying **2.0× write cost** for no benefit. Only use 1-hour when gaps > 5 min are expected.

---

## 5. Key Lessons from Claude Code

From the blog _"Prompt Caching Is Everything"_ (Anthropic, Apr 2026):

1. **Prefix match is king** — design your entire system around this. Any prefix change invalidates everything after it.
2. **Use messages for updates** — don't touch the system prompt. Put changes in next-turn messages.
3. **Don't change tools or models mid-conversation** — use tools to model state transitions instead.
4. **Monitor cache hit rate like uptime** — Claude Code runs alerts and declares SEVs when hit rate drops.
5. **Fork operations must share the parent's prefix** — compaction, summarization, skill execution should use identical cache-safe parameters.

---

## 6. Production Checklist

### Prefix Design
- [ ] Stable content above breakpoint, dynamic content below
- [ ] No timestamps, UUIDs, or dynamic data in cached sections
- [ ] Tool definitions sorted deterministically
- [ ] JSON serialization is deterministic (locked key order)

### Token Requirements
- [ ] Count tokens with Anthropic's Count Tokens endpoint (not third-party tokenizers)
- [ ] Verify cacheable block exceeds model minimum (1,024 / 2,048 / 4,096)
- [ ] Verify `usage.cache_creation_input_tokens > 0` on first request

### Observability
- [ ] Log `cache_read_input_tokens`, `cache_creation_input_tokens`, `input_tokens` per request
- [ ] Calculate hit ratio: `reads / (reads + creates + uncached)`
- [ ] Alert if hit ratio drops below 0.6
- [ ] Healthy steady state: `cache_creation_input_tokens ≈ 0`

### TTL Decision
- [ ] Steady traffic (< 5 min gaps) → 5-min TTL (1.25× write)
- [ ] Bursty / batch / low-traffic → consider 1-hr TTL (2.0× write, needs ≥2 reads/hr to win)

---

## 7. References

- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Lessons from building Claude Code: Prompt caching is everything](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything)
- [Claude Code prompt caching docs](https://code.claude.com/docs/en/prompt-caching)
- [Prompt Caching in Production — Developers Digest](https://www.developersdigest.tech/blog/prompt-caching-claude-api-production-guide)
