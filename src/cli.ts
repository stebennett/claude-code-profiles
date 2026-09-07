import { current } from './commands/current.ts';
import { create } from './commands/new.ts';
import { path } from './commands/path.ts';
import { run } from './commands/run.ts';
import type { CliDeps } from './deps.ts';
import { EXIT_OK, EXIT_USAGE } from './exit-codes.ts';
import { USAGE } from './usage.ts';
import { packageVersion } from './version.ts';

export type { CliDeps } from './deps.ts';

/**
 * The CLI's single seam. Parses `argv` (without the node and script
 * arguments), performs the work through `deps`, and returns an exit code.
 *
 * Returns a promise rather than being `async` only because nothing awaits yet;
 * the commands that do will make it `async`.
 */
export function runCli(argv: readonly string[], deps: CliDeps): Promise<number> {
  const [command] = argv;

  if (command === '--help' || command === '-h') {
    deps.stdout(USAGE);
    return Promise.resolve(EXIT_OK);
  }

  if (command === '--version' || command === '-v') {
    deps.stdout(`${packageVersion()}\n`);
    return Promise.resolve(EXIT_OK);
  }

  if (command === 'new') {
    return create(argv.slice(1), deps);
  }

  if (command === 'current') {
    return current(argv.slice(1), deps);
  }

  if (command === 'path') {
    return path(argv.slice(1), deps);
  }

  if (command === 'run') {
    return run(argv.slice(1), deps);
  }

  if (command === undefined) {
    deps.stderr(USAGE);
    return Promise.resolve(EXIT_USAGE);
  }

  deps.stderr(`ccprofile: unknown command '${command}'\n\n${USAGE}`);
  return Promise.resolve(EXIT_USAGE);
}
