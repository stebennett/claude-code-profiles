import { profileNameError } from '../core/profile-name.ts';
import { profileExists, profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import { readDefaultProfile, writeDefaultProfile } from '../core/tool-state.ts';
import type { CliDeps } from '../deps.ts';
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE } from '../exit-codes.ts';
import { noDefaultProfile, profileNotFound, unexpectedArgument, unknownOption } from '../messages.ts';

/**
 * Gets or sets the Default Profile. See docs/spec.md, "`ccprofile default`".
 *
 * Named `defaultProfile` because `default` is a keyword, the same reason `new`
 * exports `create`.
 */
export async function defaultProfile(argv: readonly string[], deps: CliDeps): Promise<number> {
  // Both checks are about a name the user typed, and a second argument cannot
  // arrive without a first, so with no name there is nothing here to refuse.
  const [name, unexpected] = argv;
  if (name !== undefined) {
    if (name.startsWith('-')) {
      deps.stderr(unknownOption(name));
      return EXIT_USAGE;
    }
    if (unexpected !== undefined) {
      deps.stderr(
        unexpectedArgument(unexpected, `default selects one Profile: ccprofile default ${name}\n`),
      );
      return EXIT_USAGE;
    }
  }

  const profilesRoot = resolveProfilesRoot(deps);

  return name === undefined ? report(profilesRoot, deps) : select(profilesRoot, name, deps);
}

/**
 * Prints the Default Profile, bare so that `ccprofile run "$(ccprofile
 * default)"` works, and with nothing on stdout when there is none — the
 * `path` shape rather than the `current` one, because there is no name to
 * print here, whereas `unknown` genuinely is what a session outside a Run is.
 *
 * What the state records is reported even if that Profile has since gone: the
 * name is the answer to what the default *is*, and a Run is where it being
 * unusable shows up.
 */
async function report(profilesRoot: string, deps: CliDeps): Promise<number> {
  const current = await readDefaultProfile(profilesRoot);
  if (current === undefined) {
    deps.stderr(noDefaultProfile());
    return EXIT_FAILED;
  }

  deps.stdout(`${current}\n`);
  return EXIT_OK;
}

/**
 * Records the Default Profile, having checked it is one. A default pointing at
 * nothing would turn a bare `run` into a failure at launch, far from the
 * command that caused it.
 */
async function select(profilesRoot: string, name: string, deps: CliDeps): Promise<number> {
  const nameError = profileNameError(name);
  if (nameError !== undefined) {
    deps.stderr(`ccprofile: ${nameError}\n`);
    return EXIT_USAGE;
  }

  if (!(await profileExists(profilePath(profilesRoot, name)))) {
    deps.stderr(profileNotFound(name, profilesRoot));
    return EXIT_FAILED;
  }

  await writeDefaultProfile(profilesRoot, name);

  // The second line is ADR-0003's mitigation, not decoration: the Default
  // Profile and the Bare Config Directory deliberately may differ, and this is
  // the moment a user acquires the divergence.
  deps.stdout(
    `Default Profile set to ${name}\n` +
      `ccprofile run with no name now Runs it. Running claude directly is unaffected.\n`,
  );
  return EXIT_OK;
}
