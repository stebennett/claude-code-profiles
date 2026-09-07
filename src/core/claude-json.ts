import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { isMissing } from '../errno.ts';

/** The file Claude Code writes inside a Config Directory on startup. */
const CLAUDE_JSON = '.claude.json';

/** What `list` needs from a Profile's own `.claude.json`. */
export interface ClaudeJson {
  /** The Profile Identity, absent until someone logs in to the Profile. */
  identity: string | undefined;
  /** When Claude Code last wrote the file, absent if it never has. */
  lastUsed: Date | undefined;
}

/**
 * Reads the two facts `list` reports out of a Profile's `.claude.json`: the
 * Profile Identity from its contents, and the last-used time from its mtime.
 */
export async function readClaudeJson(profile: string): Promise<ClaudeJson> {
  const file = join(profile, CLAUDE_JSON);

  const lastUsed = await lastWritten(file);
  // No file means the Profile has never been Run, which is the state every
  // Profile starts in: nothing to report, and nothing wrong.
  if (lastUsed === undefined) return { identity: undefined, lastUsed: undefined };

  // The mtime answers "when" on its own, so an unreadable file still reports a
  // last-used time; only the Identity is lost with the contents.
  return { identity: await readIdentity(file), lastUsed };
}

/**
 * The Profile Identity recorded in `.claude.json`, or `undefined`.
 *
 * This file is Claude Code's, so its shape is an assumption rather than a
 * contract: empty, truncated mid-write, or from a version that arranges things
 * differently are all states we can genuinely meet. Every one of them means
 * "no Identity we can name" — never a failed listing.
 */
async function readIdentity(file: string): Promise<string | undefined> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null) return undefined;

  const { oauthAccount } = parsed as { oauthAccount?: unknown };
  if (typeof oauthAccount !== 'object' || oauthAccount === null) return undefined;

  const { emailAddress } = oauthAccount as { emailAddress?: unknown };
  return typeof emailAddress === 'string' && emailAddress !== '' ? emailAddress : undefined;
}

/** When the file was last written, or `undefined` if it is not there. */
async function lastWritten(file: string): Promise<Date | undefined> {
  try {
    return (await stat(file)).mtime;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}
