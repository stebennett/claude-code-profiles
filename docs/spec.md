# ccprofile — specification (1.0)

Vocabulary in this document is defined in [`CONTEXT.md`](../CONTEXT.md). Decisions behind it are in [`docs/adr/`](./adr/).

## Purpose

Keep several independent Claude Code configurations on one machine and launch Claude Code against a chosen one, so that separate areas of work do not share configuration, MCP servers, memory, or Claude accounts.

## Package

- npm package: `ccprofile`. Binary: `ccprofile`. Repository name (`claude-code-profiles`) is unchanged.
- Node 22+, ESM only, TypeScript.
- macOS and Linux. Windows is out of scope for 1.0, but no platform-specific path handling is hardcoded (see [Seams](#library-cli-seam)).
- `npx ccprofile` supported. No standalone binary in 1.0.

## Mechanism

A Run sets `CLAUDE_CONFIG_DIR` to the Profile's directory and replaces the current process with `claude`. Nothing is copied, symlinked or merged. See ADR-0001.

Claude Code reads this configuration at session start, so a Profile is chosen at launch and cannot be changed for a running session.

## Filesystem layout

```
$CCP_PROFILES_DIR/            ← Profiles Root
├── .ccp/
│   └── config.json           ← this tool's own state
├── work/                     ← a Profile (a complete Config Directory)
│   ├── settings.json
│   ├── .claude.json          ← created by Claude Code on first Run
│   └── …
└── personal/
```

**Invariant: every visible entry in the Profiles Root is a Profile.** Tool state lives in the hidden `.ccp/` subdirectory precisely so that listing Profiles is a directory read with no exclusion list to maintain.

### Profiles Root resolution

1. `$CCP_PROFILES_DIR` if set.
2. Otherwise `$CLAUDE_CONFIG_DIR/profiles` if `CLAUDE_CONFIG_DIR` is set.
3. Otherwise `$HOME/.claude/profiles`.

The directory is created on first use. `CCP_PROFILES_DIR` is namespaced to this tool deliberately: `CLAUDE_*` belongs to Anthropic, and `CLAUDE_PROFILES_HOME` is already used by an unrelated package.

## Environment contract

A Run builds the child environment by adding exactly three variables to the inherited environment:

| Variable | Value | Why |
|---|---|---|
| `CLAUDE_CONFIG_DIR` | absolute path to the Profile | selects the Profile |
| `CCP_PROFILES_DIR` | the **resolved** Profiles Root | prevents recursion (below) |
| `CCP_ACTIVE_PROFILE` | the Profile name | makes the Active Profile discoverable |

**Recursion.** Because a Run sets `CLAUDE_CONFIG_DIR`, a `ccprofile` invoked from inside a Run would otherwise resolve its Profiles Root to `<profile>/profiles` and find nothing — Profiles nested inside Profiles. Exporting the already-resolved `CCP_PROFILES_DIR` closes this: the nested invocation inherits an explicit root and never re-derives one.

`CCP_ACTIVE_PROFILE` also distinguishes "the user set `CLAUDE_CONFIG_DIR`" from "we set it" — see [`run`](#run-name----claude-args).

## Profile names

- `[a-z0-9][a-z0-9-]*`, maximum 64 characters. A single path segment: no `.`, `..`, or separators.
- `default` is reserved.
- A directory is a Profile by virtue of its name and location, and nothing else. It needs no marker file, and a directory created by hand is a valid Profile.
- A Profile has no Profile Identity until someone logs in to it. `list` reports this honestly rather than hiding the Profile.

## Commands

### `ccprofile new <name> [--no-launch]`

1. Validate the name. Reject reserved and malformed names (exit `2`).
2. If the directory already exists, **refuse** (exit `2`). Never adopt an existing directory, so a typo cannot silently attach to something.
3. Create the directory and write a minimal `settings.json` containing only `$schema`. Claude Code never creates this file itself, so without it a Profile has no authored surface to start editing.
4. Unless `--no-launch`, delegate to `run <name>`.

`new` is documented as sugar for "create, then Run", so there is exactly one launch path in the tool. On first Run the user is prompted to log in, which is how a Profile acquires its Profile Identity; Claude Code creates `.claude.json`, `projects/`, `sessions/` and `backups/` itself.

`--no-launch` exists for scripting and for tests that must create Profiles without spawning a session.

### `ccprofile run [name] [-- claude-args…]`

- With no `name`, Runs the Default Profile (ADR-0003).
- Errors if the named Profile does not exist (exit `1`) and suggests `ccprofile new`. It does **not** create on Run: a typo would otherwise produce an empty, unauthenticated Profile and a confusing login prompt.
- Everything after `--` is forwarded to `claude` untouched.
- Replaces the current process (`exec`) so Claude Code's exit code and signal handling reach the shell unaltered.

**Warning on a user-set `CLAUDE_CONFIG_DIR`.** If `CLAUDE_CONFIG_DIR` is set *and* `CCP_ACTIVE_PROFILE` is absent, the variable came from the user rather than from us. Prompt `y/N`, defaulting to no, before overriding it. `--yes`/`-y` bypasses the prompt. If stdin is not a TTY, **fail with a clear message** rather than hanging or assuming.

Testing for the absence of `CCP_ACTIVE_PROFILE` is what stops the tool interrogating the user about a condition the tool itself created.

### `ccprofile list [--json]`

One row per Profile: name, Profile Identity (the account email, read from the Profile's own `.claude.json`), and last-used time. Profiles with no Identity yet show `(not logged in)`.

### `ccprofile current`

Prints the Active Profile from `CCP_ACTIVE_PROFILE`. Outside a Run, prints `unknown (not launched via ccprofile)` — it cannot be inferred, and guessing would be worse than admitting it.

### `ccprofile path <name>`

Prints the Profile's absolute path. This is the scripting primitive that covers what the tool deliberately does not build: `rm -rf "$(ccprofile path old)"` to delete, `cd "$(ccprofile path work)"` to edit.

### `ccprofile default [name]`

With no argument, prints the Default Profile. With one, sets it, persisting to `.ccp/config.json`.

## Errors and exit codes

| Code | Meaning |
|---|---|
| `0` | success |
| `1` | operation failed (Profile not found, refused at the prompt, non-TTY where a prompt was required) |
| `2` | usage error (bad or reserved name, directory already exists, unknown command) |

Three codes, because those are the ones a caller will branch on. Errors go to stderr; machine-readable output is opt-in via `--json`.

## Library / CLI seam

The core is a pure module; the CLI is one consumer of it (a TUI may be another, later).

**Core owns:** resolving the Profiles Root; validating and listing Profile names; reading a Profile Identity out of a Profile's `.claude.json`; resolving the Default Profile; and **building the child environment as a pure function returning an environment object**.

**CLI owns:** argument parsing, the `y/N` prompt, TTY detection, `exec`, and output formatting.

This split puts the risky logic — environment construction and path resolution — under test without spawning a process or touching a real Config Directory.

## Out of scope for 1.0

Tracked as GitHub issues: deleting Profiles; cloning a Profile (`--from`); Windows; shell `eval` integration; a TUI; declarative or shareable Profiles.

Deleting is the notable omission. A Profile holds session history and auto-memory that cannot be recovered, so 1.0 leaves the destructive act with the user, and `ccprofile path` makes it a one-liner.
