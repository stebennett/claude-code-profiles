import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { isMissing } from '../errno.ts';

/** Where a Profile of this name lives, given an already-resolved Profiles Root. */
export function profilePath(profilesRoot: string, name: string): string {
  return join(profilesRoot, name);
}

/**
 * Every Profile in the Root, by name, sorted so that two reads agree.
 *
 * Every visible entry in the Profiles Root is a Profile, and this tool's own
 * state lives in a hidden directory (docs/spec.md), so hidden entries are the
 * whole exclusion rule — there is no list of names to keep up to date.
 *
 * What remains is then held to the same test `path` and `run` apply, so the
 * three commands cannot disagree about what counts as a Profile.
 *
 * A Root that is not there yet holds no Profiles, which is the same answer as
 * an empty one: the Root is brought into being by a create, not by a read.
 */
export async function listProfileNames(profilesRoot: string): Promise<string[]> {
  const visible = (await readRoot(profilesRoot)).filter((name) => !name.startsWith('.')).sort();

  const areProfiles = await Promise.all(
    visible.map((name) => profileExists(profilePath(profilesRoot, name))),
  );

  return visible.filter((_name, index) => areProfiles[index]);
}

/** The Profiles Root's entries, or none if there is no Root there. */
async function readRoot(profilesRoot: string): Promise<string[]> {
  try {
    return await readdir(profilesRoot);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

/**
 * Whether a Profile exists at `path`. A directory is a Profile by virtue of
 * its name and location and nothing else (ADR-0002), so this is a directory
 * check and not a search for a marker file.
 *
 * Only "it is not there" is answered here: any other filesystem failure — a
 * root we cannot read, say — is reported rather than mistaken for absence.
 */
export async function profileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
