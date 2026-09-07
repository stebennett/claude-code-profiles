import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCliInHarness } from './support/cli-harness.ts';
import { givenProfile } from './support/profiles.ts';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'ccprofile-path-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('path <name>', () => {
  it("prints the Profile's absolute path and nothing else", async () => {
    const root = join(tmp, 'profiles');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(['path', 'work'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(0);
    // Bare, so `cd "$(ccprofile path work)"` gets a usable path: one line,
    // no decoration and no trailing prose.
    expect(result.stdout).toBe(`${profile}\n`);
    expect(result.stderr).toBe('');
    expect(result.launches).toEqual([]);
  });
});

describe('path <name> for a Profile that does not exist', () => {
  it('exits 1 and prints nothing on stdout, so a substitution cannot act on it', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });

    const result = await runCliInHarness(['path', 'wrok'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('wrok');
  });

  it('does not treat a plain file in the Profiles Root as a Profile', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'work'), 'not a Profile');

    const result = await runCliInHarness(['path', 'work'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
  });
});

describe('path with a name it cannot resolve', () => {
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
  ])('rejects %s with exit 2 rather than printing a path', async (_description, name) => {
    const root = join(tmp, 'profiles');
    // Present on disk, so only the name check can be what refuses it.
    await givenProfile(root, '.');

    const result = await runCliInHarness(['path', name], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(name);
  });

  it('requires a name, since a Profiles Root is not a Profile', async () => {
    const result = await runCliInHarness(['path'], { env: { CCP_PROFILES_DIR: tmp } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('requires a Profile name');
    expect(result.stdout).toBe('');
  });

  it('rejects an unknown option rather than reading it as a name', async () => {
    const result = await runCliInHarness(['path', '--json'], { env: { CCP_PROFILES_DIR: tmp } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown option '--json'");
    expect(result.stdout).toBe('');
  });

  it('rejects a second name rather than printing one of the two paths', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenProfile(root, 'personal');

    const result = await runCliInHarness(['path', 'work', 'personal'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unexpected argument 'personal'");
    expect(result.stdout).toBe('');
  });
});
