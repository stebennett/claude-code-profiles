import { buildChildEnv } from '../core/child-env.ts';
import { profileNameError } from '../core/profile-name.ts';
import { profileExists, profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import type { CliDeps } from '../deps.ts';
import { errnoCode } from '../errno.ts';
import { EXIT_FAILED, EXIT_USAGE } from '../exit-codes.ts';
import { profileNotFound, requiresProfileName, unexpectedArgument, unknownOption } from '../messages.ts';

/** Runs Claude Code under a Profile. See docs/spec.md, "`ccprofile run`". */
export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  const { own, forwarded } = splitAtDoubleDash(argv);

  const [name, unexpected, ...rest] = own;
  if (name === undefined) {
    // Running the Default Profile instead of erroring is issue #15.
    deps.stderr(requiresProfileName('run'));
    return EXIT_USAGE;
  }
  if (name.startsWith('-')) {
    deps.stderr(unknownOption(name));
    return EXIT_USAGE;
  }
  if (unexpected !== undefined) {
    const forClaude = [unexpected, ...rest].join(' ');
    deps.stderr(
      unexpectedArgument(
        unexpected,
        `Pass Claude Code's own arguments after --, as: ccprofile run ${name} -- ${forClaude}\n`,
      ),
    );
    return EXIT_USAGE;
  }

  const nameError = profileNameError(name);
  if (nameError !== undefined) {
    deps.stderr(`ccprofile: ${nameError}\n`);
    return EXIT_USAGE;
  }

  const profilesRoot = resolveProfilesRoot(deps);

  // A Run never creates: a mistyped name would otherwise leave an empty,
  // unauthenticated Profile and an unexplained login prompt.
  if (!(await profileExists(profilePath(profilesRoot, name)))) {
    deps.stderr(profileNotFound(name, profilesRoot));
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
