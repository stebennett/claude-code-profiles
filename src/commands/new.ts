import { profileNameError } from '../core/profile-name.ts';
import { createProfile } from '../core/profile-create.ts';
import { profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import type { CliDeps } from '../deps.ts';
import { EXIT_OK, EXIT_USAGE } from '../exit-codes.ts';
import { USAGE } from '../usage.ts';
import { run } from './run.ts';

const NO_LAUNCH = '--no-launch';

/** Creates a Profile and Runs it. See docs/spec.md, "`ccprofile new`". */
export async function create(argv: readonly string[], deps: CliDeps): Promise<number> {
  const noLaunch = argv.includes(NO_LAUNCH);
  const positional = argv.filter((argument) => argument !== NO_LAUNCH);

  const [name, unexpected] = positional;
  if (name === undefined) {
    deps.stderr(`ccprofile: new requires a Profile name\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  if (name.startsWith('-')) {
    deps.stderr(`ccprofile: unknown option '${name}'\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  if (unexpected !== undefined) {
    deps.stderr(
      `ccprofile: unexpected argument '${unexpected}'\n` +
        `new creates one Profile at a time: ccprofile new ${name}\n`,
    );
    return EXIT_USAGE;
  }

  // Before anything is created, so a rejected name leaves no Profiles Root
  // behind either.
  const nameError = profileNameError(name);
  if (nameError !== undefined) {
    deps.stderr(`ccprofile: ${nameError}\n`);
    return EXIT_USAGE;
  }

  const profilesRoot = resolveProfilesRoot(deps);
  const path = profilePath(profilesRoot, name);

  if ((await createProfile(path)) === 'exists') {
    deps.stderr(
      `ccprofile: ${path} already exists\n` +
        `ccprofile never adopts an existing directory. Run it with: ccprofile run ${name}\n`,
    );
    return EXIT_USAGE;
  }

  if (noLaunch) return EXIT_OK;

  // Sugar for "create, then Run": delegating keeps exactly one launch path.
  return run([name], deps);
}
