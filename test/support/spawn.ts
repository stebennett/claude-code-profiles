import { spawn } from 'node:child_process';

/** What a spawned child said, and how it ended. */
export interface Spawned {
  stdout: string;
  stderr: string;
  /** `null` when a signal killed the child rather than it exiting. */
  code: number | null;
}

/**
 * Spawns a child, collects both streams, and resolves when it closes.
 *
 * The environment is passed in whole rather than merged with this process's,
 * so that every suite spawning a child has to say what the child may see. A
 * `CLAUDE_CONFIG_DIR` or `CCP_ACTIVE_PROFILE` in the terminal running the
 * suite — the second of which is set whenever the suite is itself run from
 * inside a Run — must not be able to decide an outcome.
 *
 * The exit code is returned; a caller with nothing to say about it drops it.
 */
export function spawnCapturing(
  command: string,
  args: readonly string[],
  options: { env: NodeJS.ProcessEnv; cwd?: string },
): Promise<Spawned> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      env: options.env,
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}
