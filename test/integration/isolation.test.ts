import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  directoryExists,
  fileExists,
  givenProfile,
  givenWorkspace,
  projectSlug,
  removeWorkspace,
  runBare,
  runUnderProfile,
  type Workspace,
} from './support/workspace.ts';

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
 * A command that boots Claude Code far enough to initialise a Config
 * Directory. `claude --version` short-circuits and initialises nothing;
 * `claude -p` boots the app, and against a Profile with no Profile Identity it
 * stops at "Not logged in", having already written the directory. That stop is
 * the isolation working: the Profile does not hold the account the Bare Config
 * Directory does.
 */
const BOOT = ['-p', 'hello'];

/** What a Bare Config Directory that has been used looks like, near enough. */
const BARE_CLAUDE_JSON = `${JSON.stringify(
  {
    // A user-scope MCP server, which is what makes "the Profile sees none of
    // them" a claim about isolation rather than about an empty machine.
    mcpServers: { 'ccprofile-integration-sentinel': { command: 'ccprofile-integration-nothing' } },
  },
  undefined,
  2,
)}\n`;

let workspace: Workspace;

beforeEach(async () => {
  workspace = await givenWorkspace();
  await writeFile(workspace.bareClaudeJson, BARE_CLAUDE_JSON);
});

afterEach(async () => {
  await removeWorkspace(workspace);
});

describe('a Run against a throwaway Profile', () => {
  it('writes .claude.json inside the Profile', async () => {
    const profile = await givenProfile(workspace, 'throwaway');

    await runUnderProfile(workspace, 'throwaway', BOOT);

    await expect(fileExists(join(profile, '.claude.json'))).resolves.toBe(true);
  });

  it('leaves the Bare Config Directory .claude.json byte-identical', async () => {
    await givenProfile(workspace, 'throwaway');
    const before = await readFile(workspace.bareClaudeJson);

    await runUnderProfile(workspace, 'throwaway', BOOT);

    const after = await readFile(workspace.bareClaudeJson);
    expect(after.equals(before)).toBe(true);
  });

  it('creates its projects, sessions and backups inside the Profile', async () => {
    const profile = await givenProfile(workspace, 'throwaway');

    await runUnderProfile(workspace, 'throwaway', BOOT);

    for (const directory of ['projects', 'sessions', 'backups']) {
      await expect(
        directoryExists(join(profile, directory)),
        `${directory} should be a directory inside the Profile`,
      ).resolves.toBe(true);
    }

    // The project stamped is the directory the Run was launched from, which is
    // what says the Profile is recording this session rather than inheriting
    // somebody else's history.
    await expect(
      directoryExists(join(profile, 'projects', projectSlug(workspace.cwd))),
    ).resolves.toBe(true);
  });

  it('sees none of the MCP servers the Bare Config Directory has', async () => {
    await givenProfile(workspace, 'throwaway');

    const underProfile = await runUnderProfile(workspace, 'throwaway', ['mcp', 'list']);
    const outside = await runBare(workspace, ['mcp', 'list']);

    expect(underProfile.stdout).toContain('No MCP servers configured');
    expect(underProfile.stdout).not.toContain('ccprofile-integration-sentinel');
    expect(outside.stdout).toContain('ccprofile-integration-sentinel');
  });
});
