# Sub-Agent Creation Guide

Based on WTF(導遊伯) setup experience.

## Steps

### 1. Create the Agent
```javascript
create_agent({
  name: "AgentName",
  instructions: "Full CLAUDE.md content..."
})
```
⚠️ 需要 admin approval。

### 2. Wire to Family Group
```
ncl wirings create \
  --messaging-group-id mg-1781913974051-o3rl1w \
  --agent-group-id <agent_group_id> \
  --engage-mode pattern \
  --engage-pattern '^@(AgentName|中文名)\\b' \
  --sender-scope all \
  --ignored-message-policy accumulate \
  --session-mode shared
```
- Use `pattern` + regex, NOT `mention` (Telegram 的 @mention 只認真實 bot)
- Regex 要 match 以 @Name 開頭的訊息

### 3. Add Group Destination
```
ncl destinations add \
  --agent-group-id <agent_group_id> \
  --local-name unnamed \
  --target-type channel \
  --target-id mg-1781913974051-o3rl1w
```
讓 agent 知道可以傳回群組。

### 4. Start the Container
Send a message to the agent to trigger container start:
```
send_message({ to: "AgentName", text: "Wake up." })
```

### 5. Update 歐皮's Instructions
Add to `CLAUDE.local.md` to ignore this agent's @mentions:
```
- Ignore messages that @mention @AgentName or @中文名 — let them handle those.
```

### 6. Signing Convention
Instruct the agent to sign group messages:
```
send_message({ to: "AgentName", text: "在群組回覆時請在開頭加上 🤖 AgentName：" })
```

## Pitfalls
- `engage_mode=mention` doesn't work for non-real Telegram bots
- Auto-fill in CLI overrides `--id` from inside container — use DB write instead
- CLAUDE.local.md changes need session restart to take effect
- New agents need "unnamed" destination to reply in group
- Containers start in "stopped" state until first message triggers them
