import { mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Where this tool's own state lives, relative to the Profiles Root. */
const STATE_DIR = '.ccp';
const STATE_FILE = 'config.json';

/** The state directory, which a test may need to plant something else at. */
export function toolStateDir(root: string): string {
  return join(root, STATE_DIR);
}

/**
 * Plants this tool's own state, so a test can arrive with a Default Profile
 * already set. Takes an arbitrary object rather than a name: state a *later*
 * version may have written is as much a case worth setting up as what this one
 * writes.
 */
export async function givenToolState(root: string, state: unknown): Promise<void> {
  await givenRawToolState(root, `${JSON.stringify(state)}\n`);
}

/**
 * Plants state bytes verbatim, for the shapes `JSON.stringify` cannot produce:
 * a truncated write, an empty file, JSON that is not an object.
 */
export async function givenRawToolState(root: string, content: string): Promise<void> {
  await mkdir(toolStateDir(root), { recursive: true });
  await writeFile(join(toolStateDir(root), STATE_FILE), content);
}

/**
 * The tool state as it stands, or `undefined` if none was written. The absent
 * case is a value rather than a throw because "nothing was recorded" is what
 * several tests assert.
 */
export async function readToolState(root: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(join(toolStateDir(root), STATE_FILE), 'utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Creates a Profile the way a user would: a directory in the Profiles Root and
 * nothing else (ADR-0002). Returns its path, which is what a test asserts on.
 */
export async function givenProfile(root: string, name: string): Promise<string> {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** How the `.claude.json` a test plants should differ from a logged-in one. */
export interface UsedProfileOptions {
  /**
   * The Profile Identity, written to `oauthAccount.emailAddress` the way
   * Claude Code records it.
   */
  identity?: string;
  /** Written verbatim instead, for the partial and unparseable cases. */
  content?: string;
  /** The file's mtime, which is the last-used time `list` reports. */
  lastUsed?: Date;
}

/**
 * Creates a Profile that has been Run at least once: Claude Code writes
 * `.claude.json` inside the Config Directory on startup, and that file is
 * where both the Profile Identity and the last-used time come from.
 */
export async function givenUsedProfile(
  root: string,
  name: string,
  options: UsedProfileOptions = {},
): Promise<string> {
  const dir = await givenProfile(root, name);
  const file = join(dir, '.claude.json');

  await writeFile(
    file,
    options.content ??
      JSON.stringify(
        options.identity === undefined ? {} : { oauthAccount: { emailAddress: options.identity } },
      ),
  );

  if (options.lastUsed !== undefined) await utimes(file, options.lastUsed, options.lastUsed);

  return dir;
}
