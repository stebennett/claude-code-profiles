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
    now: () => new Date(),
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
 * Signals the terminal sends to the whole foreground process group, so the
 * child already has its own copy: Claude Code decides what Ctrl-C means, and
 * the parent stays alive only to report how the child finished.
 */
const SIGNALS_CHILD_OWNS = ['SIGINT', 'SIGQUIT'] as const;

/** Signals aimed at this process, which under `exec` would have been the child's. */
const SIGNALS_FORWARDED = ['SIGTERM', 'SIGHUP'] as const;

/**
 * Stands in for `exec`, which Node cannot do: run the child attached to this
 * process's streams and terminate this process the way the child terminated,
 * so the caller's shell sees Claude Code's own exit code or signal.
 *
 * The parent outlives the child, which a real `exec` would not, so the gap is
 * closed by hand: signals the terminal delivers to the group are left to the
 * child, signals aimed at this pid are forwarded to it, and a signalled child
 * is re-raised here rather than reported as an ordinary exit.
 *
 * None of this is reachable from the unit suite, which never spawns anything;
 * it is the real-`claude` integration test (#7) that can hold it honest.
 */
function launchAndExit(
  command: string,
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const child = spawn(command, [...args], { stdio: 'inherit', env });

    const installed: [NodeJS.Signals, () => void][] = [
      // Handling a signal with a no-op is how a Node process ignores it.
      ...SIGNALS_CHILD_OWNS.map((signal): [NodeJS.Signals, () => void] => [
        signal,
        () => undefined,
      ]),
      ...SIGNALS_FORWARDED.map((signal): [NodeJS.Signals, () => void] => [
        signal,
        () => void child.kill(signal),
      ]),
    ];

    for (const [signal, handler] of installed) process.on(signal, handler);

    child.on('error', reject);

    child.on('exit', (code, signal) => {
      if (signal !== null) {
        // Dropping the handlers this function installed — and only those —
        // restores Node's default disposition, so the shell sees a signalled
        // death rather than an exit code standing in for one.
        for (const [handled, handler] of installed) process.off(handled, handler);
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });
  });
}
