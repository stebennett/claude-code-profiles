import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { givenProfile } from '../support/profiles.ts';
import {
  directoryExists,
  fileExists,
  givenSandbox,
  removeSandbox,
  runBare,
  runUnderProfile,
  SENTINEL_SERVER,
  type Sandbox,
} from './support/sandbox.ts';

/**
 * The mechanism ADR-0001 rests on, held against a real `claude`: pointing
 * `CLAUDE_CONFIG_DIR` at a Profile isolates that Profile completely, and
 * leaves the Bare Config Directory alone.
 *
 * This suite is opted into (`npm run test:integration`) and kept out of CI: it
 * needs Claude Code installed and on PATH. It needs no Claude account —
 * everything asserted here happens before Claude Code asks for one.
 */

/**
 * Arguments that boot Claude Code far enough to initialise a Config Directory.
 * `claude --version` short-circuits and initialises nothing; `claude -p` boots
 * the app, and against a Profile with no Profile Identity it stops at "Not
 * logged in", having already written the directory. That stop is the isolation
 * working: the Profile does not hold the account the Bare Config Directory
 * does.
 */
const BOOT_ARGS = ['-p', 'hello'];

let sandbox: Sandbox;

beforeEach(async () => {
  sandbox = await givenSandbox();
});

afterEach(async () => {
  await removeSandbox(sandbox);
});

describe('a Run against a throwaway Profile', () => {
  it('writes .claude.json inside the Profile', async () => {
    const profile = await givenProfile(sandbox.profilesRoot, 'throwaway');

    await runUnderProfile(sandbox, 'throwaway', BOOT_ARGS);

    await expect(fileExists(join(profile, '.claude.json'))).resolves.toBe(true);
  });

  it('leaves the Bare Config Directory .claude.json byte-identical', async () => {
    await givenProfile(sandbox.profilesRoot, 'throwaway');
    const before = await readFile(sandbox.bareClaudeJson);

    await runUnderProfile(sandbox, 'throwaway', BOOT_ARGS);

    const after = await readFile(sandbox.bareClaudeJson);
    expect(after.equals(before)).toBe(true);
  });

  it('creates its projects, sessions and backups inside the Profile', async () => {
    const profile = await givenProfile(sandbox.profilesRoot, 'throwaway');

    await runUnderProfile(sandbox, 'throwaway', BOOT_ARGS);

    for (const directory of ['projects', 'sessions', 'backups']) {
      await expect(
        directoryExists(join(profile, directory)),
        `${directory} should be a directory inside the Profile`,
      ).resolves.toBe(true);
    }

    // One project, and it is the directory this Run was launched from: the
    // Profile is recording this session rather than inheriting a history from
    // anywhere else. How Claude Code spells the path as a directory name is
    // its own business, so only the tail is matched.
    await expect(readdir(join(profile, 'projects'))).resolves.toEqual([
      expect.stringMatching(/work$/),
    ]);
  });

  it('sees none of the MCP servers the Bare Config Directory has', async () => {
    await givenProfile(sandbox.profilesRoot, 'throwaway');

    const underProfile = await runUnderProfile(sandbox, 'throwaway', ['mcp', 'list']);
    const outside = await runBare(sandbox, ['mcp', 'list']);

    expect(underProfile.stdout).toContain('No MCP servers configured');
    expect(underProfile.stdout).not.toContain(SENTINEL_SERVER);
    expect(outside.stdout).toContain(SENTINEL_SERVER);
  });
});
