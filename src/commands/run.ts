import { buildChildEnv } from '../core/child-env.ts';
import { profileNameError } from '../core/profile-name.ts';
import { profileExists, profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import { readDefaultProfile } from '../core/tool-state.ts';
import type { CliDeps } from '../deps.ts';
import { errnoCode } from '../errno.ts';
import { EXIT_FAILED, EXIT_USAGE } from '../exit-codes.ts';
import {
  defaultProfileMissing,
  noDefaultProfile,
  profileNameRejected,
  profileNotFound,
  unexpectedArgument,
  unknownOption,
} from '../messages.ts';

/** Runs Claude Code under a Profile. See docs/spec.md, "`ccprofile run`". */
export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  const { own, forwarded } = splitAtDoubleDash(argv);

  // Every argument check here is about a name the user typed; with none there
  // is nothing to refuse, since a second argument cannot arrive without a
  // first. Nesting them says that, rather than each restating it.
  const [named, unexpected, ...rest] = own;
  if (named !== undefined) {
    if (named.startsWith('-')) {
      deps.stderr(unknownOption(named));
      return EXIT_USAGE;
    }
    if (unexpected !== undefined) {
      const forClaude = [unexpected, ...rest].join(' ');
      deps.stderr(
        unexpectedArgument(
          unexpected,
          `Pass Claude Code's own arguments after --, as: ccprofile run ${named} -- ${forClaude}\n`,
        ),
      );
      return EXIT_USAGE;
    }

    const nameError = profileNameError(named);
    if (nameError !== undefined) {
      deps.stderr(profileNameRejected(nameError));
      return EXIT_USAGE;
    }
  }

  const profilesRoot = resolveProfilesRoot(deps);

  // With no name, the Default Profile (ADR-0003). A name recorded in tool
  // state has already been held to `profileNameError` on the way out of it, so
  // only the typed one is checked above.
  const name = named ?? (await readDefaultProfile(profilesRoot));
  if (name === undefined) {
    deps.stderr(noDefaultProfile());
    return EXIT_FAILED;
  }

  // A Run never creates: a mistyped name would otherwise leave an empty,
  // unauthenticated Profile and an unexplained login prompt.
  if (!(await profileExists(profilePath(profilesRoot, name)))) {
    // Which message depends on who chose the name. `ccprofile new work` is the
    // fix for a name the user typed; for one they did not, it would be advice
    // about a Profile they never asked for.
    deps.stderr(
      named === undefined
        ? defaultProfileMissing(name, profilesRoot)
        : profileNotFound(name, profilesRoot),
    );
    return EXIT_FAILED;
  }

  try {
    return await deps.launch('claude', forwarded, buildChildEnv({ env: deps.env, profilesRoot, name }));
  } catch (error) {
    // The one launch failure worth advice: everything else is reported as it
    // came, since guessing at a cause would only obscure it.
    if (errnoCode(error) !== 'ENOENT') throw error;

    deps.stderr(
      `ccprofile: could not run 'claude'\n` +
        `Claude Code must be installed and on your PATH: https://claude.com/claude-code\n`,
    );
    return EXIT_FAILED;
  }
}

/**
 * Splits our own arguments from Claude Code's. Only the first `--` separates;
 * any later one belongs to `claude`, so it is forwarded verbatim.
 */
function splitAtDoubleDash(argv: readonly string[]): {
  own: readonly string[];
  forwarded: readonly string[];
} {
  const separator = argv.indexOf('--');
  if (separator === -1) return { own: argv, forwarded: [] };

  return { own: argv.slice(0, separator), forwarded: argv.slice(separator + 1) };
}
