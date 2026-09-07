---
status: accepted
---

# A Profile is the source of truth, not a build output

A Profile is a real Config Directory that is edited directly — by hand, and by Claude Code itself as it records memory, installs plugins and writes sessions. This tool creates, lists and Runs Profiles; it does not generate their contents from a declaration, and it never writes into a Profile after creation.

The alternative was declarative: a manifest per Profile (these MCP servers, these plugins, this model) which the tool materialises into a directory. We rejected it because Claude Code writes into that directory at runtime, so a generated Profile is dirty the moment it is used, and we would own a drift-and-reconcile problem permanently. It is also a much larger tool: configuration management wearing a profiles costume, when the job we set out to do is switching.

## Consequences

There is no drift, because there is no second copy to drift from. There is also no sharing: Profiles duplicate rather than inherit, and there is no base-plus-overlay composition and no way to share a Profile definition with someone else.

That last point is the real cost, and it is the door we expect to reopen. Distributing a team-standard Profile requires a declarative form, and at that point the honest design is a hybrid: a manifest for the parts a human authors, with the runtime-written paths (`sessions/`, `projects/`, `plugins/cache/`) declared explicitly unmanaged. That is a new decision, not an extension of this one.

A consequence worth stating because it looks like an omission: the tool has no `edit` or `set` command. Editing a Profile means opening its files, and `ccprofile path <name>` exists to make that easy. The moment the tool starts editing `settings.json` on the user's behalf, it has quietly become the declarative tool this ADR rejects.
