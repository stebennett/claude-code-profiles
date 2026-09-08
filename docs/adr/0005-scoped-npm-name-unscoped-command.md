---
status: accepted
---

# The npm package is scoped; the command it installs is not

The package is published as `@nyxcoder/ccprofile`. The binary it puts on `PATH` is `ccprofile`, unscoped and unchanged.

This was not a choice so much as a finding. `docs/spec.md` specified the unscoped name `ccprofile`, and it was verified available during design — `npm view ccprofile` returned a 404 as late as the release attempt. The registry still refused it:

```
403 Forbidden - PUT https://registry.npmjs.org/ccprofile
Package name too similar to existing package cc-profile;
try renaming your package to '@nyxcoder/ccprofile'
```

`cc-profile` is an unrelated package ("Zero-Touch Tracing & Observability for Claude Code"). npm's typosquatting check compares a proposed name against existing ones after removing punctuation, so `ccprofile` and `cc-profile` collide. A 404 on the name means unclaimed, not publishable — those are different questions, and only a publish attempt asks the second one.

The alternatives were to pick a different unscoped name, or to take the scope npm itself suggested. We took the scope. A new unscoped name would have to survive the same undocumented similarity check — with no way to test it but another failed publish — and would cost the name the documentation, the binary, the environment variables (`CCP_*`) and the repository are all already built around.

## Consequences

**Two names for one tool, and the user only needs one of them.** The scope is an address on npm; `ccprofile` is what gets typed. The README says so at the point of install, and the packaging suite asserts both halves — that `bin` is still `{ ccprofile: … }`, and that the command works when found through `PATH` and through `npx` — so a future rename cannot quietly change what users type.

**`publishConfig.access` must be `public`.** A scoped package publishes private by default, and this one has no private registry to be private on: without it a release either fails or, worse, succeeds into somewhere nobody can install from. It is in `package.json` rather than only a `--access public` flag on the publish command, so it holds for every publish route, and the packaging suite asserts it.

**The scope belongs to an account, not to the project.** `@nyxcoder` is a personal scope, so handing the package to an organisation later means a new name and a deprecation pointing at it. Accepted: the alternative was blocking the first release on creating an org.

**ADR-0004's trusted publisher is configured against the scoped name.** `npm trust github @nyxcoder/ccprofile …`, and the same name in the npmjs.com settings page.
