# ccprofile

Run Claude Code under separate, fully isolated configurations — one per area of work.

Like `AWS_PROFILE` for the AWS CLI, but for Claude Code: `ccprofile run work` and `ccprofile run personal` launch two Claude Codes that share nothing. Different MCP servers, different skills and agents, different plugins, different memory, different permissions — and **different Claude accounts**.

> Status: in development. `ccprofile new <name>` and `ccprofile run <name>` work today, so a Profile can be created, logged in to and used. Directories you create by hand (`mkdir -p ~/.claude/profiles/work`) are Profiles too — one needs nothing but its name and its place in the Profiles Root. The other commands below describe the target design. See [`docs/spec.md`](./docs/spec.md) and the [implementation checklist](../../issues/8).

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

## Install

```bash
npm install -g ccprofile     # or: npx ccprofile
```

Node 22+. macOS and Linux; Windows support is [tracked as an issue](../../issues).

## Commands

| Command | Does |
|---|---|
| `ccprofile new <name> [--no-launch]` | Create a Profile and launch it (so you can log in) |
| `ccprofile run [name] [-- args…]` | Launch Claude Code under a Profile, forwarding `args` to `claude` |
| `ccprofile list [--json]` | List Profiles with their account and last-used time |
| `ccprofile current` | Which Profile this session is running under |
| `ccprofile path <name>` | Absolute path to a Profile |
| `ccprofile default [name]` | Get or set the Profile used when `run` names none |

## Where things live

Profiles live in `$CCP_PROFILES_DIR`, defaulting to `$CLAUDE_CONFIG_DIR/profiles`, and otherwise `~/.claude/profiles`.

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
```

CI runs those four on every push and pull request, on Node 22 across Linux and macOS.

Everything is tested through one seam: `runCli(argv, deps)`, with only the
unmockable effects injected — `env`, `cwd`, `homeDir`, `stdout`, `stderr`,
`isTTY`, `confirm` and `launch`. `launch` is the load-bearing one: a Run
replaces the process, so tests assert what *would* have been executed and with
which environment, rather than spawning Claude Code. `src/process-deps.ts`
wires the real process effects in for the actual binary.

## Documentation

- [`docs/spec.md`](./docs/spec.md) — the specification
- [`CONTEXT.md`](./CONTEXT.md) — glossary
- [`docs/adr/`](./docs/adr/) — why it is built this way

## Prior art

- [`claude-profiles`](https://github.com/julianleopold/claude-profiles) swaps a fixed set of config files into `~/.claude`. It covers `settings.json`, `mcp.json`, `CLAUDE.md`, `commands/` and `hooks/`, explicitly shares credentials between profiles, and because it mutates one global directory, cannot run two profiles concurrently.
- `claude-code-profiles` on npm switches Claude accounts by symlinking `~/.claude.json` and reading and writing the macOS keychain directly. It handles auth only, not configuration.

`ccprofile` covers configuration *and* accounts in one switch, isolates everything rather than an enumerated file list, runs Profiles concurrently, and touches no credentials of its own.

## Licence

MIT
