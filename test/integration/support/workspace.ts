import { spawn } from 'node:child_process';
import type { Stats } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * The CLI as a user runs it, entry point and all. Node 22.18+ runs TypeScript
 * directly, so the opt-in suite needs no build step ahead of it.
 */
const BIN = fileURLToPath(new URL('../../../src/bin.ts', import.meta.url));

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
export interface Workspace {
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
 * Builds a Workspace in a temporary directory. Paths are real ones: macOS
 * hands out a symlinked temporary directory, and Claude Code names its
 * `projects/` entry after the resolved path.
 */
export async function givenWorkspace(): Promise<Workspace> {
  const tmp = await realpath(await mkdtemp(join(tmpdir(), 'ccprofile-integration-')));

  const workspace: Workspace = {
    root: tmp,
    home: join(tmp, 'home'),
    bareClaudeJson: join(tmp, 'home', '.claude.json'),
    profilesRoot: join(tmp, 'profiles'),
    cwd: join(tmp, 'work'),
  };

  await mkdir(workspace.home);
  await mkdir(workspace.profilesRoot);
  await mkdir(workspace.cwd);

  return workspace;
}

export async function removeWorkspace(workspace: Workspace): Promise<void> {
  await rm(workspace.root, { recursive: true, force: true });
}

/**
 * Creates a Profile the way a user would — a directory in the Profiles Root
 * and nothing else (ADR-0002) — and answers where it is.
 */
export async function givenProfile(workspace: Workspace, name: string): Promise<string> {
  const path = join(workspace.profilesRoot, name);
  await mkdir(path);
  return path;
}

/**
 * Runs `ccprofile run <name> -- <args>` for real: a Node process, which spawns
 * the `claude` on PATH, which writes to a real filesystem.
 *
 * Nothing here asserts on an exit code, and none is returned. `claude mcp
 * list` was seen to exit `0` and `1` on consecutive identical runs, and
 * `claude -p` against a Profile with no Identity exits non-zero by design;
 * neither says anything about isolation.
 */
export function runUnderProfile(
  workspace: Workspace,
  name: string,
  claudeArgs: readonly string[],
): Promise<Output> {
  return capture(process.execPath, [BIN, 'run', name, '--', ...claudeArgs], workspace, {
    CCP_PROFILES_DIR: workspace.profilesRoot,
  });
}

/**
 * Runs `claude` outside any Profile, against the Workspace's Bare Config
 * Directory. This is the control: it is what the Run under a Profile is
 * compared against.
 */
export function runBare(workspace: Workspace, claudeArgs: readonly string[]): Promise<Output> {
  return capture('claude', claudeArgs, workspace, {});
}

/**
 * Spawns a child in the Workspace and collects what it said.
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
  workspace: Workspace,
  extraEnv: Record<string, string>,
): Promise<Output> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: workspace.cwd,
      env: { PATH: process.env.PATH ?? '', HOME: workspace.home, ...extraEnv },
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

/**
 * The name Claude Code gives a working directory under `projects/`: its
 * absolute path with every character that is not a letter or a digit replaced
 * by a hyphen.
 */
export function projectSlug(cwd: string): string {
  return cwd.replaceAll(/[^a-zA-Z0-9]/g, '-');
}
