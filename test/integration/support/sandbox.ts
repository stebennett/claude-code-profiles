import { spawn } from 'node:child_process';
import type { Stats } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * The CLI as a user runs it, entry point and all. Node 22.18+ runs TypeScript
 * directly, so the opt-in suite needs no build step ahead of it.
 */
const BIN = fileURLToPath(new URL('../../../src/bin.ts', import.meta.url));

/** The MCP server planted in the Sandbox's Bare Config Directory. */
export const SENTINEL_SERVER = 'ccprofile-integration-sentinel';

/**
 * A machine to run against: a Bare Config Directory, a Profiles Root and a
 * working directory, none of them the user's.
 *
 * The home here is a throwaway rather than the real one. What is being
 * asserted is that a Run leaves the Bare Config Directory's `.claude.json`
 * untouched, and the user's own is rewritten by any Claude Code session they
 * happen to have open — which would make the assertion a race rather than a
 * fact. A home we own answers the same question and cannot damage theirs.
 */
export interface Sandbox {
  /** The temporary directory holding all of it, and the only thing to remove. */
  root: string;
  /** Stands in for `$HOME`: the Bare Config Directory lives beneath it. */
  home: string;
  /** `$HOME/.claude.json`, the file a Run must not write. */
  bareClaudeJson: string;
  profilesRoot: string;
  /** The directory a Run is launched from, which Claude Code stamps by name. */
  cwd: string;
}

/** What a child process said, minus its exit code — see `runUnderProfile`. */
export interface Output {
  stdout: string;
  stderr: string;
}

/**
 * Builds a Sandbox in a temporary directory, its Bare Config Directory holding
 * a `.claude.json` that Claude Code has never seen.
 *
 * That it is unmigrated is the point, and worth stating because the opposite
 * looks more realistic: a `.claude.json` Claude Code has already settled is
 * left alone even by a Run *without* a Profile — same bytes, same mtime — so
 * "byte-identical afterwards" would hold whether the Profile isolated anything
 * or not. An unmigrated file is rewritten the moment Claude Code owns the
 * directory it is in, which is what makes the assertion able to fail.
 *
 * Paths are resolved ones: macOS hands out a symlinked temporary directory,
 * and Claude Code names its `projects/` entry after the resolved path.
 */
export async function givenSandbox(): Promise<Sandbox> {
  const tmp = await realpath(await mkdtemp(join(tmpdir(), 'ccprofile-integration-')));

  const sandbox: Sandbox = {
    root: tmp,
    home: join(tmp, 'home'),
    bareClaudeJson: join(tmp, 'home', '.claude.json'),
    profilesRoot: join(tmp, 'profiles'),
    cwd: join(tmp, 'work'),
  };

  await mkdir(sandbox.home);
  await mkdir(sandbox.profilesRoot);
  await mkdir(sandbox.cwd);

  // A user-scope MCP server, which is what makes "the Profile sees none of
  // them" a claim about isolation rather than about an empty machine. The
  // command need not exist: `mcp list` reports a server it cannot start.
  await writeFile(
    sandbox.bareClaudeJson,
    `${JSON.stringify(
      { mcpServers: { [SENTINEL_SERVER]: { command: 'ccprofile-integration-nothing' } } },
      undefined,
      2,
    )}\n`,
  );

  return sandbox;
}

export async function removeSandbox(sandbox: Sandbox): Promise<void> {
  await rm(sandbox.root, { recursive: true, force: true });
}

/**
 * Runs `ccprofile run <name> -- <args>` for real: a Node process, which spawns
 * the `claude` on PATH, which writes to a real filesystem.
 *
 * Nothing here asserts on an exit code, and none is returned. `claude mcp
 * list` was seen to exit `0` and `1` on consecutive identical runs, and
 * `claude -p` against a Profile with no Profile Identity exits non-zero by
 * design; neither says anything about isolation.
 */
export function runUnderProfile(
  sandbox: Sandbox,
  name: string,
  claudeArgs: readonly string[],
): Promise<Output> {
  return capture(process.execPath, [BIN, 'run', name, '--', ...claudeArgs], sandbox, {
    CCP_PROFILES_DIR: sandbox.profilesRoot,
  });
}

/**
 * Runs `claude` outside any Profile, against the Sandbox's Bare Config
 * Directory. This is the control: it is what the Run under a Profile is
 * compared against.
 */
export function runBare(sandbox: Sandbox, claudeArgs: readonly string[]): Promise<Output> {
  return capture('claude', claudeArgs, sandbox, {});
}

/**
 * Spawns a child in the Sandbox and collects what it said.
 *
 * The environment is built rather than inherited, so that a `CLAUDE_CONFIG_DIR`
 * or `CCP_ACTIVE_PROFILE` in the terminal running the suite — the second of
 * which is set whenever the suite is itself run from inside a Run — cannot
 * decide the outcome. `PATH` is passed through because it is how `claude` is
 * found at all.
 */
function capture(
  command: string,
  args: readonly string[],
  sandbox: Sandbox,
  extraEnv: Record<string, string>,
): Promise<Output> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: sandbox.cwd,
      env: { PATH: process.env.PATH ?? '', HOME: sandbox.home, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));

    child.on('error', reject);
    child.on('close', () => {
      resolve({ stdout, stderr });
    });
  });
}

/** Whether a file is there — never why it is not, which no assertion needs. */
export async function fileExists(path: string): Promise<boolean> {
  return await entryIs(path, (entry) => entry.isFile());
}

/** Whether a directory is there. */
export async function directoryExists(path: string): Promise<boolean> {
  return await entryIs(path, (entry) => entry.isDirectory());
}

async function entryIs(path: string, predicate: (entry: Stats) => boolean): Promise<boolean> {
  try {
    return predicate(await stat(path));
  } catch {
    return false;
  }
}
