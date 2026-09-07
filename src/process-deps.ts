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
    isTTY: process.stdin.isTTY,
    stdout: (text) => void process.stdout.write(text),
    stderr: (text) => void process.stderr.write(text),
    confirm: askYesNo,
    launch: launchAndExit,
  };
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
 */
function launchAndExit(
  command: string,
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const child = spawn(command, [...args], { stdio: 'inherit', env });

    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'ENOENT'
          ? new Error(`could not find '${command}' on PATH`, { cause: error })
          : error,
      );
    });

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
