import type { CliDeps } from './deps.ts';
import { USAGE } from './usage.ts';
import { packageVersion } from './version.ts';

export type { CliDeps } from './deps.ts';

/** Exit codes callers branch on. See docs/spec.md, "Errors and exit codes". */
export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/**
 * The CLI's single seam. Parses `argv` (without the node and script
 * arguments), performs the work through `deps`, and returns an exit code.
 */
export async function runCli(argv: readonly string[], deps: CliDeps): Promise<number> {
  const [command] = argv;

  if (command === '--help' || command === '-h') {
    deps.stdout(USAGE);
    return Promise.resolve(EXIT_OK);
  }

  if (command === '--version' || command === '-v') {
    deps.stdout(`${packageVersion()}\n`);
    return Promise.resolve(EXIT_OK);
  }

  if (command === undefined) {
    deps.stderr(USAGE);
    return Promise.resolve(EXIT_USAGE);
  }

  deps.stderr(`ccprofile: unknown command '${command}'\n\n${USAGE}`);
  return Promise.resolve(EXIT_USAGE);
}
