import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCliInHarness } from './support/cli-harness.ts';
import {
  givenProfile,
  givenRawToolState,
  givenToolState,
  readToolState,
  toolStateDir,
} from './support/profiles.ts';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'ccprofile-default-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('default <name>', () => {
  it('persists the choice to hidden tool state under the Profiles Root', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['default', 'work'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(0);
    expect(await readToolState(root)).toEqual({ defaultProfile: 'work' });
    expect(result.launches).toEqual([]);
  });

  it('says that a bare claude is unaffected, since the two deliberately may differ', async () => {
    // ADR-0003: this tool sets an environment variable at launch and so has no
    // influence over `claude`. The output has to say so, or one word silently
    // names two things.
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['default', 'work'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.stdout).toContain('work');
    expect(result.stdout).toContain('claude directly');
    expect(result.stderr).toBe('');
  });

  it('keeps state a later version may have written alongside it', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenToolState(root, { defaultProfile: 'personal', somethingElse: 42 });

    await runCliInHarness(['default', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(await readToolState(root)).toEqual({ defaultProfile: 'work', somethingElse: 42 });
  });

  it('replaces malformed state rather than refusing to set a default', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenRawToolState(root, '{ not json');

    const result = await runCliInHarness(['default', 'work'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(0);
    expect(await readToolState(root)).toEqual({ defaultProfile: 'work' });
  });

  it('writes the state file with a trailing newline, so it reads as a text file', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    await runCliInHarness(['default', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(await readFile(join(toolStateDir(root), 'config.json'), 'utf8')).toMatch(/\n$/);
  });
});

describe('default <name> for a Profile it cannot select', () => {
  it('refuses a Profile that does not exist, so a default cannot point at nothing', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });

    const result = await runCliInHarness(['default', 'wrok'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('wrok');
    expect(result.stdout).toBe('');
    expect(await readToolState(root)).toBeUndefined();
  });

  it('does not treat a plain file in the Profiles Root as a Profile', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'work'), 'not a Profile');

    const result = await runCliInHarness(['default', 'work'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(1);
    expect(await readToolState(root)).toBeUndefined();
  });

  it.each([
    ['an uppercase letter', 'Work'],
    ['a space', 'my profile'],
    ['an underscore', 'my_profile'],
    ['a dot', 'work.bak'],
    ['a path separator', 'work/nested'],
    ['a parent-directory traversal', '../elsewhere'],
    ['the current directory', '.'],
    ['the parent directory', '..'],
    ['65 characters', 'a'.repeat(65)],
    ['the reserved name default', 'default'],
  ])('rejects %s with exit 2 rather than recording it', async (_description, name) => {
    const root = join(tmp, 'profiles');
    // Present on disk, so only the name check can be what refuses it.
    await givenProfile(root, '.');

    const result = await runCliInHarness(['default', name], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(name);
    expect(await readToolState(root)).toBeUndefined();
  });
});

describe('default', () => {
  it('prints the Default Profile bare, so a script can substitute it', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenToolState(root, { defaultProfile: 'work' });

    const result = await runCliInHarness(['default'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('work\n');
    expect(result.stderr).toBe('');
  });

  it('reports what the state records, even if that Profile has since gone', async () => {
    // The getter answers for the state; whether the Profile is still there is
    // what a Run finds out, and reporting nothing here would hide the state
    // that is causing that Run to fail.
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });
    await givenToolState(root, { defaultProfile: 'work' });

    const result = await runCliInHarness(['default'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('work\n');
  });

  it('exits 1 with nothing on stdout when no default is set', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['default'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ccprofile default <name>');
  });

  it('reports no default set for a Profiles Root that does not exist yet', async () => {
    const result = await runCliInHarness(['default'], {
      env: { CCP_PROFILES_DIR: join(tmp, 'profiles') },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
  });
});

describe('default with tool state it cannot read', () => {
  it.each([
    ['a truncated write', '{"defaultProfile": "wo'],
    ['an empty file', ''],
    ['JSON that is not an object', '"work"'],
    ['no defaultProfile key', '{"other": true}'],
    ['a defaultProfile that is not a string', '{"defaultProfile": 7}'],
    ['a defaultProfile that is empty', '{"defaultProfile": ""}'],
    ['a defaultProfile that is not a valid Profile name', '{"defaultProfile": "../elsewhere"}'],
  ])('treats %s as no default set rather than crashing', async (_description, content) => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenRawToolState(root, content);

    const result = await runCliInHarness(['default'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ccprofile default <name>');
  });

  it('treats a directory wearing the state file name as no default set', async () => {
    // Not a shape `JSON.parse` can fail on: the read itself fails, with
    // EISDIR. The file is not there and something else has its name, which is
    // a malformed state rather than one we should have been able to read.
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await mkdir(join(toolStateDir(root), 'config.json'), { recursive: true });

    const result = await runCliInHarness(['default'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ccprofile default <name>');
  });

  it('reports a state file it should have been able to read, rather than ignoring it', async () => {
    // The other side of the line: a state that is present but unreadable is a
    // real failure, and answering "no default set" would hide it.
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenRawToolState(root, '{"defaultProfile": "work"}');
    await chmod(join(toolStateDir(root), 'config.json'), 0o000);

    await expect(
      runCliInHarness(['default'], { env: { CCP_PROFILES_DIR: root } }),
    ).rejects.toThrow(/EACCES|permission/i);

    // Restored so the temporary directory can be removed.
    await chmod(join(toolStateDir(root), 'config.json'), 0o600);
  });
});

describe('default with arguments it cannot act on', () => {
  it('rejects an unknown option rather than reading it as a name', async () => {
    const result = await runCliInHarness(['default', '--json'], {
      env: { CCP_PROFILES_DIR: tmp },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown option '--json'");
    expect(result.stdout).toBe('');
  });

  it('rejects a second name rather than recording one of the two', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenProfile(root, 'personal');

    const result = await runCliInHarness(['default', 'work', 'personal'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unexpected argument 'personal'");
    expect(result.stdout).toBe('');
    expect(await readToolState(root)).toBeUndefined();
  });
});
