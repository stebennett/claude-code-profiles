import type { CliDeps } from '../deps.ts';
import { EXIT_OK, EXIT_USAGE } from '../exit-codes.ts';
import { unexpectedArgument, unknownOption } from '../messages.ts';

/**
 * What a session with no Active Profile reports. Only a Run records one, so
 * anything else genuinely cannot be identified: `CLAUDE_CONFIG_DIR` may point
 * inside the Profiles Root without this tool having put it there, and naming
 * that Profile would be a guess dressed as an answer.
 */
const UNKNOWN = 'unknown (not launched via ccprofile)';

/**
 * Prints the Active Profile. See docs/spec.md, "`ccprofile current`".
 *
 * The one command with nothing to await: reading the environment is all it
 * does, so it returns a promise rather than being `async`.
 */
export function current(argv: readonly string[], deps: CliDeps): Promise<number> {
  const [unexpected] = argv;
  if (unexpected !== undefined) {
    if (unexpected.startsWith('-')) {
      deps.stderr(unknownOption(unexpected));
      return Promise.resolve(EXIT_USAGE);
    }

    deps.stderr(
      unexpectedArgument(
        unexpected,
        `current reports the Profile this session is under; to launch one, use: ccprofile run ${unexpected}\n`,
      ),
    );
    return Promise.resolve(EXIT_USAGE);
  }

  // An unset variable and an empty one mean the same thing here: no Run set it.
  const active = deps.env.CCP_ACTIVE_PROFILE;
  deps.stdout(`${active === undefined || active === '' ? UNKNOWN : active}\n`);
  return Promise.resolve(EXIT_OK);
}
