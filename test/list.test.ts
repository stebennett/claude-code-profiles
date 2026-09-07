import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCliInHarness } from './support/cli-harness.ts';
import { givenProfile, givenUsedProfile } from './support/profiles.ts';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'ccprofile-list-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const HOUR = 60 * 60 * 1000;

describe('list', () => {
  it('prints one row per Profile with its name, account and last-used time', async () => {
    const root = join(tmp, 'profiles');
    const lastUsed = new Date('2026-09-07T12:00:00Z');
    await givenUsedProfile(root, 'work', { account: 'steve@example.com', lastUsed });

    const result = await runCliInHarness(['list'], {
      env: { CCP_PROFILES_DIR: root },
      now: new Date(lastUsed.getTime() + 2 * HOUR),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      'NAME  ACCOUNT            LAST USED\n' + //
        'work  steve@example.com  2 hours ago\n',
    );
    expect(result.stderr).toBe('');
  });
});

describe('list for a Profile with no Profile Identity', () => {
  it('lists a brand-new Profile rather than hiding what it cannot report', async () => {
    const root = join(tmp, 'profiles');
    // A Profile is a directory and nothing else (ADR-0002): until it has been
    // Run there is no `.claude.json`, and so neither an account nor a time.
    await givenProfile(root, 'scratch');

    const result = await runCliInHarness(['list'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      'NAME     ACCOUNT          LAST USED\n' + //
        'scratch  (not logged in)  never\n',
    );
  });

  it('reports a Profile that has been Run but never logged in to', async () => {
    const root = join(tmp, 'profiles');
    const lastUsed = new Date('2026-09-07T12:00:00Z');
    // Claude Code writes `.claude.json` on startup whether or not anyone logs
    // in, so a used Profile can still have no Identity.
    await givenUsedProfile(root, 'scratch', { lastUsed });

    const result = await runCliInHarness(['list'], {
      env: { CCP_PROFILES_DIR: root },
      now: new Date(lastUsed.getTime() + 3 * HOUR),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('scratch  (not logged in)  3 hours ago');
  });
});

describe('list where `.claude.json` is not what we expect', () => {
  // `.claude.json` belongs to Claude Code, not to us. Every one of these is a
  // file we might genuinely meet — half-written, from a future version, or
  // truncated — and none of them is a reason to fail the whole listing.
  it.each([
    ['empty', ''],
    ['truncated mid-write', '{"oauthAccount": {"emailAdd'],
    ['not JSON at all', 'not json'],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['a bare JSON string', '"hello"'],
    ['an oauthAccount that is null', '{"oauthAccount": null}'],
    ['an oauthAccount with no email', '{"oauthAccount": {"accountUuid": "abc"}}'],
    ['an email that is not a string', '{"oauthAccount": {"emailAddress": 42}}'],
  ])('reports no Identity for a `.claude.json` that is %s', async (_description, content) => {
    const root = join(tmp, 'profiles');
    await givenUsedProfile(root, 'work', { content });

    const result = await runCliInHarness(['list'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('work');
    expect(result.stdout).toContain('(not logged in)');
    expect(result.stderr).toBe('');
  });

  it('still reports the last-used time, which the mtime gives whatever the contents say', async () => {
    const root = join(tmp, 'profiles');
    const lastUsed = new Date('2026-09-07T12:00:00Z');
    await givenUsedProfile(root, 'work', { content: 'not json', lastUsed });

    const result = await runCliInHarness(['list'], {
      env: { CCP_PROFILES_DIR: root },
      now: new Date(lastUsed.getTime() + 5 * HOUR),
    });

    expect(result.stdout).toContain('5 hours ago');
  });
});

describe('list and what is not a Profile', () => {
  it("does not list hidden entries, so the tool's own state stays out of the way", async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    // Tool state lives in a hidden directory precisely so that listing needs
    // no exclusion list: skipping hidden entries is the whole rule.
    await givenProfile(root, '.ccp');
    await mkdir(join(root, '.cache'), { recursive: true });

    const result = await runCliInHarness(['list'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('work');
    expect(result.stdout).not.toContain('.ccp');
    expect(result.stdout).not.toContain('.cache');
  });

  it('does not list a plain file, which is not a Profile', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await writeFile(join(root, 'notes.txt'), 'not a Profile');

    const result = await runCliInHarness(['list'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.stdout).toContain('work');
    expect(result.stdout).not.toContain('notes.txt');
  });

  it('lists a symlinked directory, which `path` and `run` both accept as a Profile', async () => {
    const root = join(tmp, 'profiles');
    const elsewhere = await givenProfile(join(tmp, 'other'), 'stored-away');
    await mkdir(root, { recursive: true });
    await symlink(elsewhere, join(root, 'linked'));

    const result = await runCliInHarness(['list'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.stdout).toContain('linked');
  });
});

describe('list with arguments it cannot place', () => {
  it('rejects an unknown option rather than silently ignoring it', async () => {
    const result = await runCliInHarness(['list', '--verbose'], {
      env: { CCP_PROFILES_DIR: tmp },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown option '--verbose'");
    expect(result.stdout).toBe('');
  });

  it('rejects a Profile name, since it lists every Profile rather than one', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['list', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unexpected argument 'work'");
    expect(result.stdout).toBe('');
  });
});

describe('list last-used column', () => {
  const WRITTEN = new Date('2026-09-07T12:00:00Z');
  const MINUTE = 60 * 1000;
  const DAY = 24 * HOUR;

  it.each([
    ['seconds', 30 * 1000, 'just now'],
    ['a minute', MINUTE, '1 minute ago'],
    ['minutes', 5 * MINUTE, '5 minutes ago'],
    ['an hour', HOUR, '1 hour ago'],
    ['a day', 25 * HOUR, '1 day ago'],
    ['days', 3 * DAY, '3 days ago'],
    ['a month', 30 * DAY, '1 month ago'],
    ['months', 90 * DAY, '3 months ago'],
    ['a year', 400 * DAY, '1 year ago'],
    // A Profile's mtime comes from the filesystem, so a clock this tool does
    // not own can put it ahead of now. Reading as `just now` beats a negative.
    ['a clock ahead of the file', -HOUR, 'just now'],
  ])('renders %s as "%s"', async (_description, elapsed, expected) => {
    const root = join(tmp, 'profiles');
    await givenUsedProfile(root, 'work', { account: 'me@example.com', lastUsed: WRITTEN });

    const result = await runCliInHarness(['list'], {
      env: { CCP_PROFILES_DIR: root },
      now: new Date(WRITTEN.getTime() + elapsed),
    });

    expect(result.stdout).toContain(`me@example.com  ${expected}\n`);
  });
});

describe('list ordering', () => {
  it('orders by name whatever order the Profiles were created in', async () => {
    const root = join(tmp, 'profiles');
    for (const name of ['work', 'archive', 'personal', 'zebra', 'client-a']) {
      await givenProfile(root, name);
    }

    const result = await runCliInHarness(['list'], { env: { CCP_PROFILES_DIR: root } });
    const names = result.stdout
      .split('\n')
      .slice(1)
      .filter((line) => line !== '')
      .map((line) => line.split(' ')[0]);

    expect(names).toEqual(['archive', 'client-a', 'personal', 'work', 'zebra']);
  });

  it('gives the same order twice, so a diff of two listings is meaningful', async () => {
    const root = join(tmp, 'profiles');
    for (const name of ['work', 'archive', 'personal']) await givenProfile(root, name);
    const env = { CCP_PROFILES_DIR: root };

    const [first, second] = await Promise.all([
      runCliInHarness(['list', '--json'], { env }),
      runCliInHarness(['list', '--json'], { env }),
    ]);

    expect(first.stdout).toBe(second.stdout);
  });
});

describe('list --json', () => {
  it('emits one object per Profile with stable field names', async () => {
    const root = join(tmp, 'profiles');
    const lastUsed = new Date('2026-09-07T12:00:00Z');
    const work = await givenUsedProfile(root, 'work', {
      account: 'steve@example.com',
      lastUsed,
    });
    const scratch = await givenProfile(root, 'scratch');

    const result = await runCliInHarness(['list', '--json'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(0);
    // Absent facts are null, not the human placeholders: nothing consuming
    // this should have to parse the string "(not logged in)".
    expect(JSON.parse(result.stdout)).toEqual([
      { name: 'scratch', path: scratch, account: null, lastUsed: null },
      { name: 'work', path: work, account: 'steve@example.com', lastUsed: lastUsed.toISOString() },
    ]);
    expect(result.stderr).toBe('');
  });

  it('emits an empty array for an empty Profiles Root', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });

    const result = await runCliInHarness(['list', '--json'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(result.stderr).toBe('');
  });
});

describe('list with no Profiles', () => {
  it('says so and suggests creating one, rather than printing a bare heading row', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });

    const result = await runCliInHarness(['list'], { env: { CCP_PROFILES_DIR: root } });

    // Having no Profiles is an answer, not a failure: exit 0.
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No Profiles');
    expect(result.stdout).toContain('ccprofile new');
    expect(result.stderr).toBe('');
  });

  it.each([
    ['human', [], 'No Profiles'],
    ['--json', ['--json'], '[]'],
  ])(
    'treats a Profiles Root that does not exist as empty (%s)',
    async (_description, flags, expected) => {
      // `list` only reads: it is a create or a Run that brings the Root into being.
      const result = await runCliInHarness(['list', ...flags], {
        env: { CCP_PROFILES_DIR: join(tmp, 'never-created') },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(expected);
      expect(result.stderr).toBe('');
    },
  );
});
