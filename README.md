# ccprofile

Run Claude Code under separate, fully isolated configurations — one per area of work.

Like `AWS_PROFILE` for the AWS CLI, but for Claude Code: `ccprofile run work` and `ccprofile run personal` launch two Claude Codes that share nothing. Different MCP servers, different skills and agents, different plugins, different memory, different permissions — and **different Claude accounts**.

> Status: 1.0. Every command in the table below works, a `CLAUDE_CONFIG_DIR` you set yourself is asked about before a Run overrides it, and isolation itself is covered by an integration test against a real `claude` (`npm run test:integration`). Directories you create by hand (`mkdir -p ~/.claude/profiles/work`) are Profiles too — one needs nothing but its name and its place in the Profiles Root. See [`docs/spec.md`](./docs/spec.md) and the [implementation checklist](../../issues/8). What is deliberately left out is [below](#deliberately-not-included).

## Why

One `~/.claude` accumulates everything: the MCP servers for your day job, the skills for a side project, plugins you only need in one repo. Every session pays for all of it, and work context leaks into personal context.

`ccprofile` gives each area of work its own Claude Code configuration directory and launches Claude Code against the one you pick.

## How it works

Claude Code reads its user configuration from the directory named by `CLAUDE_CONFIG_DIR`. `ccprofile` keeps a directory per Profile and sets that variable at launch:

```bash
ccprofile new work          # create it, launch it, log in
ccprofile run work          # launch Claude Code under the "work" Profile
ccprofile run work -- --model opus
ccprofile list              # what Profiles exist, and which account each uses

ccprofile default work      # make "work" the Profile a bare run launches
ccprofile run               # …so the area of work you use most is the shortest command
```

Nothing is copied, symlinked, or merged. Your existing `~/.claude` is never written to.

Because it is a whole-directory swap, isolation covers everything Claude Code keeps per user: settings, `CLAUDE.md`, skills, agents, commands, plugins, sessions, auto-memory, per-project trust and tool-permission grants, and MCP servers — including claude.ai connectors.

Each Profile is a real directory you can edit by hand. `ccprofile` creates, lists and launches them; it never rewrites their contents. `ccprofile path work` tells you where one lives.

## Multi-account is the point

Claude Code keys its credentials to the configuration directory. So each Profile logs in separately, and a `work` Profile can be a different Claude account from `personal` — no re-authenticating when you switch, and no shared login.

**`ccprofile` never reads, writes, or stores a credential.** It sets one environment variable; Claude Code's own credential handling does the rest, keychain included. There is no token cache in this tool to leak.

A new Profile therefore starts with no account and no connectors, and prompts you to log in on its first launch. That is the isolation working, not a bug.

## Per-terminal, not global

Because a Profile is selected by an environment variable at launch, two terminals can run two Profiles **at the same time**. There is no global "active profile" to fight over, and no hidden state that changes what a new terminal does.

The trade-off: a Profile is chosen when Claude Code starts. Claude Code reads its configuration at session start, so switching Profile means starting a new session.

## If you set `CLAUDE_CONFIG_DIR` yourself

Setting that variable by hand is a deliberate act, so a Run tells you before overriding it:

```
$ ccprofile run work
ccprofile: CLAUDE_CONFIG_DIR is set to /Users/you/claude-experiment
This Run overrides it with the Profile 'work' at /Users/you/.claude/profiles/work
Override it? [y/N]
```

It defaults to **no**, so a stray keypress cannot discard your setup. `-y`/`--yes` skips the question, and with no terminal to ask on — a script, a CI job — the Run fails saying so rather than hanging or guessing.

The prompt is rare by design: inside a Run the variable is one `ccprofile` set, and being asked about the tool's own doing would make the question routine, and so unread.

## Install

```bash
npm install -g ccprofile     # or: npx ccprofile
```

Node 22+. macOS and Linux; Windows support is [tracked as an issue](../../issues).

Both install routes are checked on every push, on both of those platforms: CI packs the package, installs it globally, runs the installed binary, and runs the tarball through `npx` (`npm run test:package`). The Node floor is declared in `engines` rather than tested — CI runs Node 22 and nothing older.

## Commands

| Command | Does |
|---|---|
| `ccprofile new <name> [--no-launch]` | Create a Profile and launch it (so you can log in) |
| `ccprofile run [name] [-y] [-- args…]` | Launch Claude Code under a Profile, forwarding `args` to `claude` |
| `ccprofile list [--json]` | List Profiles with their account and last-used time |
| `ccprofile current` | Which Profile this session is running under |
| `ccprofile path <name>` | Absolute path to a Profile |
| `ccprofile default [name]` | Get or set the Profile used when `run` names none |

## Where things live

Profiles live in `$CCP_PROFILES_DIR`, defaulting to `$CLAUDE_CONFIG_DIR/profiles`, and otherwise `~/.claude/profiles`.

`ccprofile`'s own state — currently just your chosen default — lives in `.ccp/config.json` beneath that root. It is hidden so that every *visible* entry in the Profiles Root is a Profile, which is why listing Profiles needs no exclusion list. Delete it and you have no default; nothing else is lost.

`ccprofile default` is the Profile `ccprofile run` uses when you name none. It does **not** change what plain `claude` does — that always uses `~/.claude`, and no tool that works by setting an environment variable can change it. See [ADR-0003](./docs/adr/0003-default-profile-diverges-from-bare-claude.md).

## Deliberately not included

Deleting a Profile. A Profile holds session history and auto-memory that cannot be recovered, so the destructive act stays with you:

```bash
rm -rf "$(ccprofile path old-profile)"
```

Also out of scope for 1.0: cloning Profiles, shell integration, a TUI, and declarative/shareable Profile definitions. All [tracked as issues](../../issues).

## Development

Node 22+. TypeScript, ESM only.

```bash
npm install
npm run typecheck    # tsc, source and tests
npm run lint         # eslint
npm test             # vitest — no claude on PATH, no credentials, no network
npm run build        # tsc → dist/
npm run test:package # packs, installs globally into a throwaway prefix, runs it

npm run test:integration   # opt-in: needs Claude Code installed and on PATH
```

CI runs all five on every push and pull request, on Node 22 across Linux and macOS.

`test:package` is the one that costs seconds rather than milliseconds, and it
is in CI anyway: the matrix is the only honest way to claim the package
installs and runs on both platforms. Everything it asserts is asserted against
the tarball `npm pack` produced — the package metadata, that the tarball holds
the built entry point and nothing a user does not need to run it, that the
installed `ccprofile` on `PATH` prints its usage and creates and lists a
Profile, and that `npx` can run it too. It needs no `claude`: `--no-launch` is
what keeps it from wanting one. It writes only to a temporary prefix, home and
Profiles Root, so it cannot install over a `ccprofile` you have.

The integration suite is deliberately not among them. It launches a real
`claude` under a throwaway Profile and checks the mechanism the whole tool
rests on ([ADR-0001](./docs/adr/0001-directory-swap-via-claude-config-dir.md)):
`.claude.json`, `projects/`, `sessions/` and `backups/` are created inside the
Profile, MCP servers configured outside it are invisible within it, and
`$HOME/.claude.json` is byte-identical afterwards. It needs no Claude
account — everything it asserts happens before Claude Code asks for one — and
it runs against a temporary home of its own, so your configuration is neither
read nor written. Exit codes are never asserted on: `claude` returns them
inconsistently here, and they say nothing about isolation.

Almost everything is tested through one seam: `runCli(argv, deps)`, with only the
unmockable effects injected — `env`, `cwd`, `homeDir`, `stdout`, `stderr`,
`isTTY`, `now`, `confirm` and `launch`. `launch` is the load-bearing one: a Run
replaces the process, so tests assert what *would* have been executed and with
which environment, rather than spawning Claude Code. `now` is what makes
`list`'s relative times a fact rather than a race. `src/process-deps.ts`
wires the real process effects in for the actual binary.

The one exception is `src/yes-no.ts`, tested directly. Faking `confirm` at the
seam is what puts the *default* of the `y/N` prompt beyond it, and "an empty
answer means no" guards configuration the user set on purpose, so it is worth
a test rather than a promise.

Profiles themselves are real directories in a real temporary Profiles Root, so
the filesystem is exercised rather than faked; `test/support/profiles.ts`
creates them — and plants the tool's own state — the way a user or Claude Code
would.

## Releasing

Publishing happens in CI, not on anyone's machine. A pushed `v*` tag runs the
release workflow, which requires the full CI matrix to pass and then publishes
with provenance ([ADR-0004](./docs/adr/0004-publish-to-npm-from-ci.md)):

```bash
npm version 1.0.1        # commits the bump and tags it
git push && git push --tags
```

The workflow refuses a tag whose version disagrees with `package.json`, so the
tag and what npm serves cannot drift apart. It needs one thing this repository
cannot hold: an npm granular access token with publish rights for `ccprofile`,
stored as the `NPM_TOKEN` repository secret.

## Documentation

- [`docs/spec.md`](./docs/spec.md) — the specification
- [`CONTEXT.md`](./CONTEXT.md) — glossary
- [`docs/adr/`](./docs/adr/) — why it is built this way, publishing included

## Prior art

- [`claude-profiles`](https://github.com/julianleopold/claude-profiles) swaps a fixed set of config files into `~/.claude`. It covers `settings.json`, `mcp.json`, `CLAUDE.md`, `commands/` and `hooks/`, explicitly shares credentials between profiles, and because it mutates one global directory, cannot run two profiles concurrently.
- `claude-code-profiles` on npm switches Claude accounts by symlinking `~/.claude.json` and reading and writing the macOS keychain directly. It handles auth only, not configuration.

`ccprofile` covers configuration *and* accounts in one switch, isolates everything rather than an enumerated file list, runs Profiles concurrently, and touches no credentials of its own.

## Licence

MIT
