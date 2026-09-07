import { profileNameError } from '../core/profile-name.ts';
import { profileExists, profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import type { CliDeps } from '../deps.ts';
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE } from '../exit-codes.ts';
import { profileNotFound, requiresProfileName, unknownOption } from '../messages.ts';

/** Prints a Profile's absolute path. See docs/spec.md, "`ccprofile path`". */
export async function path(argv: readonly string[], deps: CliDeps): Promise<number> {
  const [name, unexpected] = argv;
  if (name === undefined) {
    deps.stderr(requiresProfileName('path'));
    return EXIT_USAGE;
  }
  if (name.startsWith('-')) {
    deps.stderr(unknownOption(name));
    return EXIT_USAGE;
  }
  if (unexpected !== undefined) {
    deps.stderr(
      `ccprofile: unexpected argument '${unexpected}'\n` +
        `path prints one Profile at a time: ccprofile path ${name}\n`,
    );
    return EXIT_USAGE;
  }

  const nameError = profileNameError(name);
  if (nameError !== undefined) {
    deps.stderr(`ccprofile: ${nameError}\n`);
    return EXIT_USAGE;
  }

  const profilesRoot = resolveProfilesRoot(deps);
  const profile = profilePath(profilesRoot, name);

  // Checked rather than printed unconditionally: `cd "$(ccprofile path wrok)"`
  // would otherwise be handed a path to nothing and fail further from the typo.
  if (!(await profileExists(profile))) {
    deps.stderr(profileNotFound(name, profilesRoot));
    return EXIT_FAILED;
  }

  deps.stdout(`${profile}\n`);
  return EXIT_OK;
}
