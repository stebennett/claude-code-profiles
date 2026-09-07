---
status: accepted
---

# The Default Profile may differ from what bare `claude` launches

`ccprofile run` with no Profile named launches the Default Profile, which is configurable. Running `claude` directly launches the Bare Config Directory. These are deliberately allowed to differ: if the Default Profile is set to `work`, then `ccprofile run` gives you `work` while `claude` gives you `~/.claude`.

This is not an oversight. This tool works by setting an environment variable at launch, so it has no influence whatsoever over a bare `claude` invocation — there is no mechanism by which the two could be made to agree, short of installing a shim over the `claude` command, which we are not willing to do to a user's shell.

The rejected alternative was to make `default` a fixed synonym for the Bare Config Directory, guaranteeing the two are always identical. We chose configurability instead, accepting the divergence.

## Consequences

One word names two things, and a user who has set a Default Profile must know which command they typed to know which configuration they got. Two things mitigate it, and both are load-bearing rather than cosmetic:

- The glossary names them separately — **Default Profile** and **Bare Config Directory** — and the tool's own output and documentation never use "default" to mean the latter.
- Every Run exports `CCP_ACTIVE_PROFILE` into the session, so the Active Profile is always discoverable from inside a session. `ccprofile current` reports `unknown` outside a Run rather than guessing, because a bare `claude` session genuinely cannot be identified.

Anyone wanting the two to agree should set no Default Profile, or alias `claude` themselves — a visible alias they own, rather than invisible state inside this tool.
