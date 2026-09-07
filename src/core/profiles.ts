import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { errnoCode } from '../errno.ts';

/** Where a Profile of this name lives, given an already-resolved Profiles Root. */
export function profilePath(profilesRoot: string, name: string): string {
  return join(profilesRoot, name);
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
    const code = errnoCode(error);
    // ENOTDIR: a path component is a file, so nothing can exist beneath it.
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw error;
  }
}
