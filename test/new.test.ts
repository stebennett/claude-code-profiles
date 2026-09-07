import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LAUNCHED, runCliInHarness } from './support/cli-harness.ts';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'ccprofile-new-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('new <name> --no-launch', () => {
  it('creates the Profile with a settings.json holding only $schema, and launches nothing', async () => {
    const root = join(tmp, 'profiles');

    const result = await runCliInHarness(['new', 'work', '--no-launch'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(0);
    expect(result.launches).toEqual([]);

    const settings: unknown = JSON.parse(
      await readFile(join(root, 'work', 'settings.json'), 'utf8'),
    );
    expect(Object.keys(settings as Record<string, unknown>)).toEqual(['$schema']);
  });
});

describe('new with a name it will not create', () => {
  it.each([
    ['an uppercase letter', 'Work'],
    ['a space', 'my profile'],
    ['an underscore', 'my_profile'],
    ['a dot', 'work.bak'],
    ['a path separator', 'work/nested'],
    ['a parent-directory traversal', '../elsewhere'],
    ['the parent directory', '..'],
    ['65 characters', 'a'.repeat(65)],
    ['the reserved name default', 'default'],
  ])('rejects %s with exit 2, creating nothing', async (_description, name) => {
    const root = join(tmp, 'profiles');

    const result = await runCliInHarness(['new', name], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(name);
    expect(result.launches).toEqual([]);
    // Not even the Profiles Root: nothing is created before the name is known
    // to be one we would create.
    expect(await readdir(tmp)).toEqual([]);
  });

  it('requires a name', async () => {
    const result = await runCliInHarness(['new'], { env: { CCP_PROFILES_DIR: join(tmp, 'p') } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('requires a Profile name');
    expect(result.launches).toEqual([]);
    expect(await readdir(tmp)).toEqual([]);
  });

  it('rejects an unknown option rather than reading it as a name', async () => {
    const result = await runCliInHarness(['new', '--launch', 'work'], {
      env: { CCP_PROFILES_DIR: join(tmp, 'p') },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown option '--launch'");
    expect(await readdir(tmp)).toEqual([]);
  });

  it('rejects a second argument rather than silently dropping it', async () => {
    const result = await runCliInHarness(['new', 'work', 'personal'], {
      env: { CCP_PROFILES_DIR: join(tmp, 'p') },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('personal');
    expect(await readdir(tmp)).toEqual([]);
  });
});

describe('new <name> where something is already there', () => {
  it('refuses an existing directory with exit 2, adopting nothing and launching nothing', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(join(root, 'work', 'skills'), { recursive: true });

    const result = await runCliInHarness(['new', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('work');
    expect(result.launches).toEqual([]);
    // Untouched: no settings.json written into the directory it refused.
    expect(await readdir(join(root, 'work'))).toEqual(['skills']);
  });

  it('refuses a plain file at the Profile path with exit 2, leaving it as it was', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'work'), 'not a Profile');

    const result = await runCliInHarness(['new', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(2);
    expect(result.launches).toEqual([]);
    await expect(readFile(join(root, 'work'), 'utf8')).resolves.toBe('not a Profile');
  });
});

describe('new <name> when creation fails part-way', () => {
  it('leaves no partial Profile behind when settings.json cannot be written', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });
    // A umask that strips write permission makes the directory `new` has just
    // created unwritable, so the settings.json write fails after the mkdir
    // succeeded — the one point where a partial Profile could survive.
    const umask = process.umask(0o222);
    try {
      await expect(
        runCliInHarness(['new', 'work', '--no-launch'], { env: { CCP_PROFILES_DIR: root } }),
      ).rejects.toThrow();
    } finally {
      process.umask(umask);
    }

    expect(await readdir(root)).toEqual([]);
  });
});

describe('new <name>', () => {
  it('creates the Profile and then Runs it, so the user is prompted to log in', async () => {
    const root = join(tmp, 'profiles');

    const result = await runCliInHarness(['new', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.command).toBe('claude');
    expect(result.launches[0]?.args).toEqual([]);
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(join(root, 'work'));
    expect(result.launches[0]?.env.CCP_ACTIVE_PROFILE).toBe('work');
    await expect(readFile(join(root, 'work', 'settings.json'), 'utf8')).resolves.toContain(
      '$schema',
    );
  });

  it('creates a Profile that a later run finds, which is what --no-launch is for', async () => {
    const root = join(tmp, 'profiles');
    const env = { CCP_PROFILES_DIR: root };

    expect((await runCliInHarness(['new', 'work', '--no-launch'], { env })).exitCode).toBe(0);
    const result = await runCliInHarness(['run', 'work'], { env });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(join(root, 'work'));
  });
});
