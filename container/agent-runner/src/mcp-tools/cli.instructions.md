## ncl CLI

`ncl <resource> <verb> [--flags]` — read or modify NanoClaw config.

### Key rules

- **`--id` is auto-filled** for `groups` and `destinations` — never pass it.
- **Read** (list, get) runs immediately.
- **Write** (restart, config update, create, update, delete, add, remove) needs **admin approval**. You get `approval-pending` — that's normal, not an error. **Don't retry with different flags.** The result arrives as a system message.
- `ncl groups config update` → `ncl groups restart` to take effect.

### Common commands

| What | Command |
|------|---------|
| Your config | `ncl groups config get` |
| Restart | `ncl groups restart` |
| Restart + message | `ncl groups restart --message "..."` |
| Members | `ncl members list` |
| Sessions | `ncl sessions list` |
| Help | `ncl help` or `ncl <resource> help` |

Run `ncl groups help` for config fields. Under `global` scope you also get: messaging-groups, wirings, users, roles, approvals.
