import { createProfile } from '../core/profile-create.ts';
import { profileNameError } from '../core/profile-name.ts';
import { profileExists, profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import type { CliDeps } from '../deps.ts';
import { EXIT_OK, EXIT_USAGE } from '../exit-codes.ts';
import {
  profileNameRejected,
  requiresProfileName,
  unexpectedArgument,
  unknownOption,
} from '../messages.ts';
import { run } from './run.ts';

const NO_LAUNCH = '--no-launch';

/** Creates a Profile and Runs it. See docs/spec.md, "`ccprofile new`". */
export async function create(argv: readonly string[], deps: CliDeps): Promise<number> {
  const noLaunch = argv.includes(NO_LAUNCH);
  const positional = argv.filter((argument) => argument !== NO_LAUNCH);

  const [name, unexpected] = positional;
  if (name === undefined) {
    deps.stderr(requiresProfileName('new'));
    return EXIT_USAGE;
  }
  if (name.startsWith('-')) {
    deps.stderr(unknownOption(name));
    return EXIT_USAGE;
  }
  if (unexpected !== undefined) {
    deps.stderr(
      unexpectedArgument(unexpected, `new creates one Profile at a time: ccprofile new ${name}\n`),
    );
    return EXIT_USAGE;
  }

  // Before anything is created, so a rejected name leaves no Profiles Root
  // behind either.
  const nameError = profileNameError(name);
  if (nameError !== undefined) {
    deps.stderr(profileNameRejected(nameError));
    return EXIT_USAGE;
  }

  const profilesRoot = resolveProfilesRoot(deps);
  const path = profilePath(profilesRoot, name);

  if ((await createProfile(path)) === 'exists') {
    // A directory here is already a Profile (ADR-0002), so running it is what
    // the user wanted. Anything else at that path is not, and suggesting a Run
    // would only send them into a second, differently worded failure.
    const advice = (await profileExists(path))
      ? `It is already a Profile. Run it with: ccprofile run ${name}\n`
      : `ccprofile never adopts what is already there. Move it aside, or pick another name.\n`;

    deps.stderr(`ccprofile: ${path} already exists\n${advice}`);
    return EXIT_USAGE;
  }

  if (noLaunch) return EXIT_OK;

  // Sugar for "create, then Run": delegating keeps exactly one launch path.
  return run([name], deps);
}
