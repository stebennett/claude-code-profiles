---
status: accepted
---

# Releasing is a pushed tag: CI stages, a human approves

A pushed `v*` tag runs `.github/workflows/release.yml`, which authenticates to npm over OIDC as a **trusted publisher** — no stored credential of any kind — and *stages* the version. A human then approves it with 2FA, and only then does it reach the registry. Nobody publishes from a laptop, and no maintainer needs an npm login to release.

The rejected alternative was the obvious one: `npm login && npm publish` by hand. It is fewer moving parts, and for a first publish it is genuinely quicker. We rejected it for three reasons, in order of weight:

- **What gets published is what is in the repository.** A local publish uploads a working tree. It can contain an uncommitted edit, a stale `dist/`, or a dependency the lockfile does not have, and npm versions are immutable — the mistake cannot be taken back, only superseded. A tag-triggered publish can only upload a commit that exists here.
- **The checks are not optional.** The release workflow calls `ci.yml` as a reusable workflow rather than repeating its steps, so a release requires the same typecheck, lint, unit suite and packaging suite that every push gets, on both macOS and Linux. A local publish requires whatever the person remembered to run.
- **There is no credential to leak.** Not a token in a repository secret, and not one in a `~/.npmrc` on every machine that might release. The registry trusts this repository, this workflow file and this environment, and issues something short-lived on the spot.

We also rejected a **stored publish token**, which is what this workflow used when first written. npm is retiring the only kind that works unattended: from early August 2026 a 2FA-bypass granular token can no longer change package settings, and from around January 2027 it cannot publish at all — leaving exactly "staging a publish, where a package only becomes public after a human 2FA approval". Building on a credential with a known end date, when the replacement was available, would have been work done twice.

And we rejected **direct publishing over OIDC**, which a trusted publisher can be configured to allow. Staging is npm's default for a reason GitHub states plainly: it puts a human between a compromised workflow and the registry. The cost is that a release is two acts rather than one.

The costs accepted: a release needs the trusted publisher to exist on npm's side, a failed release is debugged through workflow logs rather than a terminal, and no version publishes itself.

## Consequences

**Releasing is: bump the version, merge, tag, push the tag — then approve.** The workflow refuses a tag whose version disagrees with `package.json`, so the two cannot drift apart unnoticed. Its job summary prints the `npm stage approve` command for the version it staged.

**A one-time setup is required, and it is not in this repository.** A trusted publisher on `@nyxcoder/ccprofile` (the name is scoped: see [ADR-0005](./0005-scoped-npm-name-unscoped-command.md)) naming owner/repo `stebennett/claude-code-profiles`, workflow file `.github/workflows/release.yml`, environment `npm-publish`, with staged publishing allowed. Three of those are strings in this repository that npm matches literally: **renaming the workflow file or the environment breaks releases until npm's side is changed to match**, and npm fixes a connection's fields once created, so a correction means revoking and re-adding.

**The environment is load-bearing twice.** It is half of the OIDC match, and it is where a reviewer-approval rule can be added to releases alone without gating any other job.

**The publish job runs a newer Node than the package supports.** Trusted publishing needs npm 11.5.1+ and staging needs 11.15+, while the Node 22 the package targets ships npm 10. So that job uses Node 24 and installs `npm@^11`, and the package's own floor is held by `verify`, which is the matrix that actually tests it. These are unrelated numbers that look related, which is the whole reason to write it down.

**1.0.0 was published by hand, and carries no provenance.** A trusted publisher is configured against a package that already exists, and a brand-new package cannot be staged either — so the first version had to be a direct, locally authenticated publish, and provenance requires CI's OIDC identity. Every later version is staged from a tagged commit and attested automatically. `npm/cli#8544` is the request to remove this catch; until then, a first release is a documented exception rather than something this workflow can do.

**A version already on the registry is a success, not a failure.** The workflow skips staging when the version it was tagged for is already published. That is what lets `v1.0.0` be tagged after the fact, and what makes re-running a tag harmless. An immutable registry is what makes "already there" the same outcome as "just done".
