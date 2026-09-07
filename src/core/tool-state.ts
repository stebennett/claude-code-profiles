import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isMissing } from '../errno.ts';
import { profileNameError } from './profile-name.ts';

/**
 * This tool's own state, the one thing under the Profiles Root that is not a
 * Profile. It is hidden precisely so that listing Profiles stays a directory
 * read with no exclusion list to maintain (docs/spec.md, "Filesystem layout").
 */
const STATE_DIR = '.ccp';
const STATE_FILE = 'config.json';

/** The key the Default Profile is recorded under. */
const DEFAULT_PROFILE = 'defaultProfile';

/** Where the state file lives, given an already-resolved Profiles Root. */
function stateFile(profilesRoot: string): string {
  return join(profilesRoot, STATE_DIR, STATE_FILE);
}

/**
 * The Default Profile, or `undefined` if none is set.
 *
 * Every way the file can fail to name one — absent, empty, truncated
 * mid-write, valid JSON that is not an object, a `defaultProfile` that is not
 * a string, or one that is not a valid Profile name — is "no default set". The
 * state is ours, but it is a file on disk that a user can edit and a future
 * version may extend, so none of those is a reason to refuse a command.
 *
 * The name is validated on the way out as well as on the way in: state written
 * by hand has not been through `default <name>`, and a `..` recorded here
 * would otherwise reach `profilePath` as a Profile name.
 */
export async function readDefaultProfile(profilesRoot: string): Promise<string | undefined> {
  const state = await readState(profilesRoot);

  const recorded = state[DEFAULT_PROFILE];
  if (typeof recorded !== 'string' || profileNameError(recorded) !== undefined) return undefined;

  return recorded;
}

/**
 * Records the Default Profile, bringing the state directory into being.
 *
 * Keys we do not recognise are written back untouched, so state a later
 * version added is not lost by an older one setting a default.
 */
export async function writeDefaultProfile(profilesRoot: string, name: string): Promise<void> {
  const state = { ...(await readState(profilesRoot)), [DEFAULT_PROFILE]: name };

  await mkdir(join(profilesRoot, STATE_DIR), { recursive: true });
  await writeFile(stateFile(profilesRoot), `${JSON.stringify(state, undefined, 2)}\n`);
}

/**
 * The state file's contents as an object, or an empty one for every state it
 * cannot be read as: there is nothing in an unreadable state worth preserving,
 * so a set overwrites it rather than failing on it.
 */
async function readState(profilesRoot: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(stateFile(profilesRoot), 'utf8'));
  } catch (error) {
    // Only absence is expected; a state file we cannot read for any other
    // reason — no permission, say — is a real failure and stays a throw.
    if (error instanceof SyntaxError || isMissing(error)) return {};
    throw error;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  return parsed as Record<string, unknown>;
}
