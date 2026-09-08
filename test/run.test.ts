import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LAUNCHED, runCliInHarness } from './support/cli-harness.ts';
import { givenProfile, givenRawToolState, givenToolState } from './support/profiles.ts';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'ccprofile-run-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('run <name>', () => {
  it('launches claude with CLAUDE_CONFIG_DIR set to the Profile', async () => {
    const root = join(tmp, 'profiles');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches).toHaveLength(1);
    expect(result.launches[0]?.command).toBe('claude');
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
  });

  it('adds exactly three variables to the inherited environment', async () => {
    // No CCP_PROFILES_DIR or CLAUDE_CONFIG_DIR inherited, so all three
    // variables have to be added rather than passed through.
    const homeDir = join(tmp, 'home');
    const root = join(homeDir, '.claude', 'profiles');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { PATH: '/usr/bin', TERM: 'xterm', EMPTY: undefined },
      homeDir,
    });

    expect(result.launches[0]?.env).toEqual({
      PATH: '/usr/bin',
      TERM: 'xterm',
      CLAUDE_CONFIG_DIR: profile,
      CCP_PROFILES_DIR: root,
      CCP_ACTIVE_PROFILE: 'work',
    });
  });

  it('overwrites a CCP_ACTIVE_PROFILE inherited from an outer Run', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: {
        CCP_PROFILES_DIR: root,
        CLAUDE_CONFIG_DIR: join(root, 'personal'),
        CCP_ACTIVE_PROFILE: 'personal',
      },
    });

    expect(result.launches[0]?.env.CCP_ACTIVE_PROFILE).toBe('work');
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(join(root, 'work'));
  });

  it('forwards everything after -- to claude, in order and untouched', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(
      ['run', 'work', '--', '--model', 'opus', '-p', 'hello --world', '--help'],
      { env: { CCP_PROFILES_DIR: root } },
    );

    expect(result.launches[0]?.args).toEqual([
      '--model',
      'opus',
      '-p',
      'hello --world',
      '--help',
    ]);
    expect(result.stdout).toBe('');
  });

  it('passes no arguments to claude when none were given', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.launches[0]?.args).toEqual([]);
  });
});

describe('run <name> when claude cannot be launched', () => {
  it('exits 1 naming claude and PATH when claude is not installed', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root },
      launchError: Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('claude');
    expect(result.stderr).toContain('PATH');
  });

  it('reports any other launch failure rather than shaping it into advice', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    await expect(
      runCliInHarness(['run', 'work'], {
        env: { CCP_PROFILES_DIR: root },
        launchError: Object.assign(new Error('permission denied'), { code: 'EACCES' }),
      }),
    ).rejects.toThrow('permission denied');
  });
});

describe('run under a CLAUDE_CONFIG_DIR the user set', () => {
  it('exits 1 and launches nothing when the prompt is declined', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: join(tmp, 'hand-set') },
      confirm: () => Promise.resolve(false),
    });

    expect(result.exitCode).toBe(1);
    expect(result.launches).toEqual([]);
  });

  it('launches with the Profile when the prompt is accepted, overriding the variable', async () => {
    const root = join(tmp, 'profiles');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: join(tmp, 'hand-set') },
      confirm: () => Promise.resolve(true),
    });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
  });

  it('names the path being overridden and the Profile replacing it', async () => {
    const root = join(tmp, 'profiles');
    const handSet = join(tmp, 'hand-set');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: handSet },
      confirm: () => Promise.resolve(false),
    });

    expect(result.stderr).toContain(handSet);
    expect(result.stderr).toContain("'work'");
    expect(result.stderr).toContain(profile);
    expect(result.stdout).toBe('');
  });

  // The harness rejects an unanswered prompt, so reaching a launch at all is
  // what says no prompt appeared.
  it.each([
    ['CCP_ACTIVE_PROFILE is present, since a Run set the variable', 'personal'],
    ['CCP_ACTIVE_PROFILE names the same Profile this Run selected', 'work'],
  ])('stays silent when %s', async (_description, active) => {
    const root = join(tmp, 'profiles');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: {
        CCP_PROFILES_DIR: root,
        CLAUDE_CONFIG_DIR: join(root, active),
        CCP_ACTIVE_PROFILE: active,
      },
    });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
    expect(result.stderr).toBe('');
  });

  it.each([
    ['unset', undefined],
    // Empty is absent everywhere else in the tool, so there is no path here to
    // warn about overriding.
    ['empty', ''],
  ])('stays silent when CLAUDE_CONFIG_DIR is %s', async (_description, configDir) => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: configDir },
    });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.stderr).toBe('');
  });

  it.each([
    ['--yes before the name', ['run', '--yes', 'work']],
    ['--yes after the name', ['run', 'work', '--yes']],
    ['-y', ['run', '-y', 'work']],
  ])('bypasses the prompt with %s', async (_description, argv) => {
    const root = join(tmp, 'profiles');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(argv, {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: join(tmp, 'hand-set') },
    });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
  });

  it('forwards a -- -y to claude rather than reading it as its own', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work', '--', '-y'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: join(tmp, 'hand-set') },
      confirm: () => Promise.resolve(true),
    });

    expect(result.launches[0]?.args).toEqual(['-y']);
  });

  it('exits 1 naming --yes without prompting when stdin is not a TTY', async () => {
    const root = join(tmp, 'profiles');
    const handSet = join(tmp, 'hand-set');
    await givenProfile(root, 'work');

    // No `confirm`: the harness rejects one, which is how "does not hang"
    // becomes a fact here rather than an absence of evidence.
    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: handSet },
      isTTY: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(handSet);
    expect(result.stderr).toContain('--yes');
    expect(result.launches).toEqual([]);
  });

  it('needs no TTY once --yes has answered the question', async () => {
    const root = join(tmp, 'profiles');
    const profile = await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work', '--yes'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: join(tmp, 'hand-set') },
      isTTY: false,
    });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
  });
});

describe('run with no name', () => {
  it('Runs the Default Profile', async () => {
    const root = join(tmp, 'profiles');
    const profile = await givenProfile(root, 'work');
    await givenToolState(root, { defaultProfile: 'work' });

    const result = await runCliInHarness(['run'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
    // The Active Profile is the Profile's own name, not `default`: a session
    // has to be able to say which configuration it is under (ADR-0003).
    expect(result.launches[0]?.env.CCP_ACTIVE_PROFILE).toBe('work');
  });

  it('still forwards everything after -- to claude', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenToolState(root, { defaultProfile: 'work' });

    const result = await runCliInHarness(['run', '--', '--model', 'opus'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(LAUNCHED);
    expect(result.launches[0]?.args).toEqual(['--model', 'opus']);
  });

  it('exits 1 explaining how to set a default when none is set', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ccprofile default <name>');
    expect(result.launches).toEqual([]);
  });

  it('treats malformed tool state as no default set rather than crashing', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');
    await givenRawToolState(root, '{"defaultProfile": tr');

    const result = await runCliInHarness(['run'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ccprofile default <name>');
    expect(result.launches).toEqual([]);
  });

  it('names the Default Profile when it has since gone, rather than a name nobody typed', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });
    await givenToolState(root, { defaultProfile: 'work' });

    const result = await runCliInHarness(['run'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Default Profile 'work'");
    // Not `ccprofile new work`: the fix is choosing another default, and the
    // user never typed this name.
    expect(result.stderr).toContain('ccprofile default <name>');
    expect(result.launches).toEqual([]);
  });
});

describe('run with arguments it cannot act on', () => {
  // `-y` was this example until it became an option run understands; an
  // option it does not is still refused rather than read as a name.
  it('rejects an unknown option rather than reading it as a name', async () => {
    const result = await runCliInHarness(['run', '--model', 'work'], {
      env: { CCP_PROFILES_DIR: tmp },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown option '--model'");
    expect(result.launches).toEqual([]);
  });

  it('rejects a second argument rather than silently dropping it', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'work');

    const result = await runCliInHarness(['run', 'work', '--model', 'opus'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('ccprofile run work -- --model opus');
    expect(result.launches).toEqual([]);
  });
});

describe('run <name> for a Profile that does not exist', () => {
  it('exits 1, suggests ccprofile new, and creates nothing', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });

    const result = await runCliInHarness(['run', 'wrok'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('wrok');
    expect(result.stderr).toContain('ccprofile new wrok');
    expect(result.launches).toEqual([]);
    expect(await readdir(root)).toEqual([]);
  });

  it('exits 1 without creating a Profiles Root that does not exist yet', async () => {
    const root = join(tmp, 'profiles');

    const result = await runCliInHarness(['run', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.launches).toEqual([]);
    expect(await readdir(tmp)).toEqual([]);
  });

  it('does not treat a plain file in the Profiles Root as a Profile', async () => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'work'), 'not a Profile');

    const result = await runCliInHarness(['run', 'work'], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(1);
    expect(result.launches).toEqual([]);
  });
});

describe('run <name> with an invalid name', () => {
  it.each([
    ['an uppercase letter', 'Work'],
    ['a space', 'my profile'],
    ['a leading hyphen', '-work'],
    ['an underscore', 'my_profile'],
    ['a dot', 'work.bak'],
    ['a path separator', 'work/nested'],
    ['a parent-directory traversal', '../elsewhere'],
    ['the current directory', '.'],
    ['the parent directory', '..'],
    ['65 characters', 'a'.repeat(65)],
  ])('rejects %s with exit 2 and launches nothing', async (_description, name) => {
    const root = join(tmp, 'profiles');
    await mkdir(root, { recursive: true });

    const result = await runCliInHarness(['run', name], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(name);
    expect(result.stdout).toBe('');
    expect(result.launches).toEqual([]);
    expect(await readdir(root)).toEqual([]);
  });

  it('accepts 64 characters, the longest a name may be', async () => {
    const root = join(tmp, 'profiles');
    const name = 'a'.repeat(64);
    await givenProfile(root, name);

    const result = await runCliInHarness(['run', name], { env: { CCP_PROFILES_DIR: root } });

    expect(result.exitCode).toBe(LAUNCHED);
  });

  it('rejects the reserved name default with exit 2, saying it is reserved', async () => {
    const root = join(tmp, 'profiles');
    await givenProfile(root, 'default');

    const result = await runCliInHarness(['run', 'default'], {
      env: { CCP_PROFILES_DIR: root },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('reserved');
    expect(result.launches).toEqual([]);
  });
});

describe('Profiles Root resolution', () => {
  it('prefers $CCP_PROFILES_DIR, using it verbatim rather than re-deriving a root', async () => {
    const root = join(tmp, 'explicit-root');
    await givenProfile(root, 'work');
    // The environment as it looks inside a Run of another Profile: every
    // variable is already set, and re-deriving the root would look in
    // <outer profile>/profiles — which exists here, so a re-derived root
    // would launch something rather than fail visibly.
    const outer = await givenProfile(root, 'personal');
    const nested = await givenProfile(join(outer, 'profiles'), 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: root, CLAUDE_CONFIG_DIR: outer, CCP_ACTIVE_PROFILE: 'personal' },
    });

    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(join(root, 'work'));
    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).not.toBe(nested);
    expect(result.launches[0]?.env.CCP_PROFILES_DIR).toBe(root);
  });

  it('falls back to $CLAUDE_CONFIG_DIR/profiles', async () => {
    const configDir = join(tmp, 'config');
    const profile = await givenProfile(join(configDir, 'profiles'), 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CLAUDE_CONFIG_DIR: configDir, CCP_ACTIVE_PROFILE: 'previous' },
    });

    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
    expect(result.launches[0]?.env.CCP_PROFILES_DIR).toBe(join(configDir, 'profiles'));
  });

  it('falls back to $HOME/.claude/profiles', async () => {
    const homeDir = join(tmp, 'home');
    const profile = await givenProfile(join(homeDir, '.claude', 'profiles'), 'work');

    const result = await runCliInHarness(['run', 'work'], { env: {}, homeDir });

    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
    expect(result.launches[0]?.env.CCP_PROFILES_DIR).toBe(
      join(homeDir, '.claude', 'profiles'),
    );
  });

  it.each([
    ['$CCP_PROFILES_DIR', { CCP_PROFILES_DIR: 'profiles' }],
    // `CCP_ACTIVE_PROFILE` keeps this about root resolution: without it a
    // set `CLAUDE_CONFIG_DIR` is the override guard's business instead.
    ['$CLAUDE_CONFIG_DIR', { CLAUDE_CONFIG_DIR: '.', CCP_ACTIVE_PROFILE: 'previous' }],
  ])('resolves a relative %s against the working directory', async (_source, env) => {
    const profile = await givenProfile(join(tmp, 'profiles'), 'work');

    const result = await runCliInHarness(['run', 'work'], { env, cwd: tmp });

    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
  });

  it('treats an empty variable as unset rather than as a root', async () => {
    const homeDir = join(tmp, 'home');
    const profile = await givenProfile(join(homeDir, '.claude', 'profiles'), 'work');

    const result = await runCliInHarness(['run', 'work'], {
      env: { CCP_PROFILES_DIR: '', CLAUDE_CONFIG_DIR: '' },
      cwd: tmp,
      homeDir,
    });

    expect(result.launches[0]?.env.CLAUDE_CONFIG_DIR).toBe(profile);
  });
});
