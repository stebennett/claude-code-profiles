import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { errnoCode } from '../errno.ts';

/**
 * The published Claude Code settings schema, written into every new Profile so
 * an editor can complete and validate `settings.json`. It is known to lag
 * Claude Code itself, so it is an editor convenience and not a source of truth.
 */
const SETTINGS_SCHEMA = 'https://json.schemastore.org/claude-code-settings.json';

/**
 * Creates a Profile at `path`, containing the minimal `settings.json` Claude
 * Code never writes itself. See docs/spec.md, "`ccprofile new`".
 *
 * Reports `'exists'` rather than adopting whatever is already at `path`, so a
 * typo cannot silently attach to something. The non-recursive `mkdir` is what
 * decides that: the filesystem answers "already there" atomically, leaving no
 * window between a check and a create.
 */
export async function createProfile(path: string): Promise<'created' | 'exists'> {
  await mkdir(dirname(path), { recursive: true });

  try {
    await mkdir(path);
  } catch (error) {
    if (errnoCode(error) === 'EEXIST') return 'exists';
    throw error;
  }

  try {
    await writeFile(
      join(path, 'settings.json'),
      `${JSON.stringify({ $schema: SETTINGS_SCHEMA }, undefined, 2)}\n`,
    );
  } catch (error) {
    // Nothing half-made is left in the Profiles Root, where every visible
    // entry is a Profile: the directory only just came into being here, so
    // removing it can lose nothing of the user's.
    await rm(path, { recursive: true, force: true });
    throw error;
  }

  return 'created';
}
