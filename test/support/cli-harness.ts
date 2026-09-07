import type { CliDeps } from '../../src/deps.ts';
import { runCli } from '../../src/cli.ts';

export interface LaunchAttempt {
  command: string;
  args: readonly string[];
  env: Readonly<Record<string, string>>;
}

/**
 * `exitCode` when the CLI got as far as replacing the process. A real Run has
 * no exit code of its own — Claude Code's becomes the process's — so there is
 * no number to report here.
 */
export const LAUNCHED = 'launched';

export interface CliResult {
  exitCode: number | typeof LAUNCHED;
  stdout: string;
  stderr: string;
  launches: readonly LaunchAttempt[];
}

export interface HarnessOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  homeDir?: string;
  isTTY?: boolean;
  /** Answers the confirmation prompt. Throws if unset and a prompt is reached. */
  confirm?: (question: string) => Promise<boolean>;
  /** Fails the launch with this error, standing in for a failed `exec`. */
  launchError?: Error;
}

/**
 * Stands in for the process replacement a real `launch` performs: control never
 * returns to `runCli`, so the fake throws rather than returning a value the
 * production code could go on to use.
 */
class ProcessReplaced extends Error {}

/**
 * Drives the CLI through its one seam, `runCli(argv, deps)`, with every effect
 * faked. Nothing is spawned: `launch` records what would have been executed.
 */
export async function runCliInHarness(
  argv: readonly string[],
  options: HarnessOptions = {},
): Promise<CliResult> {
  let stdout = '';
  let stderr = '';
  const launches: LaunchAttempt[] = [];

  const deps: CliDeps = {
    env: options.env ?? {},
    cwd: options.cwd ?? '/tmp/ccprofile-test-cwd',
    homeDir: options.homeDir ?? '/tmp/ccprofile-test-home',
    isTTY: options.isTTY ?? true,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    confirm:
      options.confirm ??
      ((question) => Promise.reject(new Error(`unexpected prompt: ${question}`))),
    launch: (command, args, env) => {
      launches.push({ command, args, env });
      return Promise.reject(options.launchError ?? new ProcessReplaced(command));
    },
  };

  let exitCode: number | typeof LAUNCHED;
  try {
    exitCode = await runCli(argv, deps);
  } catch (error) {
    if (!(error instanceof ProcessReplaced)) throw error;
    exitCode = LAUNCHED;
  }

  return { exitCode, stdout, stderr, launches };
}
