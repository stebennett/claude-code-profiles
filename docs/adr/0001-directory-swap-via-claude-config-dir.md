---
status: accepted
---

# Swap whole Config Directories via CLAUDE_CONFIG_DIR

A Run launches Claude Code with `CLAUDE_CONFIG_DIR` pointed at the chosen Profile, rather than copying, symlinking or merging configuration into the Bare Config Directory. We chose this because a whole-directory swap isolates everything Claude Code keeps per user — including things we would otherwise have to enumerate and maintain a list of — and because it never writes to the user's existing configuration, so the failure mode of a bug is "the wrong Profile launched", not "your configuration is gone".

## Considered options

**File-swapping into the Bare Config Directory** (copy the Profile's files over `~/.claude`, deleting what the target Profile lacks). Rejected: it mutates the one directory the user cannot afford to lose; it requires an explicit list of managed paths that silently rots every time Claude Code adds a new one; and because it mutates a single global location, two concurrent sessions cannot hold different Profiles.

**Symlinking parts of the Bare Config Directory.** Rejected: same single-global-location problem, plus symlink semantics vary across tools and platforms.

**Merging JSON fragments from a declaration.** Rejected for the reasons in ADR-0002.

## Consequences

Isolation is complete and verified empirically: settings, `CLAUDE.md`, skills, agents, commands, plugins, sessions, auto-memory, per-project trust and tool-permission grants, MCP servers (including claude.ai connectors), and credentials all partition per Profile. `.claude.json` is created inside the Profile, and `$HOME/.claude.json` is left untouched.

Because credentials are keyed to the Config Directory, **each Profile authenticates separately**. We treat this as the feature rather than a cost: two Profiles can hold two different Claude accounts, and this tool never reads, writes or stores a credential itself.

Two costs are accepted. Each Profile carries its own plugin cache, so a plugin used by several Profiles is downloaded several times. And a Profile is selected at launch: Claude Code reads this configuration at session start, so a running session's Profile cannot be changed.

## Known risk

The `claude-profiles` npm package implemented this approach and then reversed it — its changelog records "Breaking: File-swap profile switching replaces `CLAUDE_CONFIG_DIR` approach" in 0.2.0 — with **no recorded reason**. We believe that reversal predates Claude Code honouring the variable consistently (a change its own changelog describes as "Respect CLAUDE_CONFIG_DIR everywhere"), and our own testing shows complete isolation today. But we are knowingly betting against a predecessor's judgment on the central mechanism of this tool. If that bet proves wrong, the fallback is file-swapping, and it invalidates this ADR rather than adjusting it.
