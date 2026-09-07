import type { CliDeps } from '../../src/deps.ts';
import { runCli } from '../../src/cli.ts';

export interface LaunchAttempt {
  command: string;
  args: readonly string[];
  env: Readonly<Record<string, string>>;
}

export interface CliResult {
  exitCode: number;
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
}

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
      // A real launch replaces the process, so control never returns. The fake
      // signals the same thing by never resolving normally.
      return Promise.reject(new LaunchedError());
    },
  };

  let exitCode: number;
  try {
    exitCode = await runCli(argv, deps);
  } catch (error) {
    if (!(error instanceof LaunchedError)) throw error;
    exitCode = 0;
  }

  return { exitCode, stdout, stderr, launches };
}

/** Thrown by the fake `launch` to stand in for the process being replaced. */
class LaunchedError extends Error {
  constructor() {
    super('launched');
    this.name = 'LaunchedError';
  }
}
