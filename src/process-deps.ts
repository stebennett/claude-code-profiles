import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';

import type { CliDeps } from './deps.ts';

/** Wires the real process effects into the shape `runCli` consumes. */
export function processDeps(): CliDeps {
  return {
    env: process.env,
    cwd: process.cwd(),
    homeDir: homedir(),
    isTTY: stdinIsTTY(),
    stdout: (text) => void process.stdout.write(text),
    stderr: (text) => void process.stderr.write(text),
    confirm: askYesNo,
    launch: launchAndExit,
  };
}

/**
 * `@types/node` declares `isTTY` as `boolean`, but Node leaves it `undefined`
 * when stdin is not a terminal — the case the guard in `run` exists to catch —
 * so the declared type is a lie worth reading through.
 */
function stdinIsTTY(): boolean {
  return (process.stdin as { isTTY?: boolean }).isTTY ?? false;
}

/** Prompts on the terminal, defaulting to no on an empty or unrecognised answer. */
async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/**
 * Stands in for `exec`, which Node cannot do: run the child attached to this
 * process's streams, then exit with whatever it exited with, so the caller's
 * shell sees Claude Code's own exit code and signal.
 *
 * The parent survives for the child's lifetime, which `exec` would not, so
 * signal handling is not yet identical to running `claude` directly. #11 owns
 * getting that exact.
 */
function launchAndExit(
  command: string,
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const child = spawn(command, [...args], { stdio: 'inherit', env });

    child.on('error', reject);

    child.on('exit', (code, signal) => {
      if (signal !== null) {
        // Re-raise so the shell sees a signalled death, not an ordinary exit.
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });
  });
}
