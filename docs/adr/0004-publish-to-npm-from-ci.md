---
status: accepted
---

# Publishing to npm happens in CI, triggered by a version tag

`npm publish` runs in a GitHub Actions workflow that fires on a pushed `v*` tag (`.github/workflows/release.yml`). Nobody publishes from a laptop, and no maintainer needs an npm login to release.

The rejected alternative was the obvious one: `npm login && npm publish` by hand. It is fewer moving parts, and for a first publish it is genuinely quicker. We rejected it for three reasons, in order of weight:

- **What gets published is what is in the repository.** A local publish uploads a working tree. It can contain an uncommitted edit, a stale `dist/`, or a dependency the lockfile does not have, and npm versions are immutable — the mistake cannot be taken back, only superseded. A tag-triggered publish can only upload a commit that exists here.
- **The checks are not optional.** The release workflow calls `ci.yml` as a reusable workflow rather than repeating its steps, so a publish requires the same typecheck, lint, unit suite and packaging suite that every push gets, on both macOS and Linux. A local publish requires whatever the person remembered to run.
- **The credential is not on a machine.** A granular npm token lives in one repository secret, scoped to this package, rather than in a `~/.npmrc` on every machine that might release.

The cost is that a release needs the token to exist, and that a failed publish is debugged through workflow logs rather than a terminal. Both are accepted.

## Consequences

**Releasing is: bump the version, merge, tag, push the tag.** The workflow refuses a tag whose version disagrees with `package.json`, so the two cannot drift apart unnoticed.

**A one-time setup is required, and it is not in this repository.** A granular npm access token with publish rights for `ccprofile`, stored as the `NPM_TOKEN` repository secret. The `npm-publish` environment the workflow names exists so a reviewer-approval rule can be added to publishes without gating anything else.

**The first publish is the awkward one.** npm's trusted publishing (OIDC, no stored token) is the better end state, but it is configured against a package that already exists. So this release uses a token, and moving to a trusted publisher afterwards is a change to this workflow alone — the `id-token: write` permission it already requests for provenance is the same one trusted publishing needs.

**Provenance is on.** `--provenance` makes the link between the published tarball and the commit and workflow that built it public on the package page. It works because this repository is public and the `repository` field matches; both would have to stay true.
