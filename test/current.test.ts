import { describe, expect, it } from 'vitest';

import { runCliInHarness } from './support/cli-harness.ts';

describe('current inside a Run', () => {
  it('prints the Active Profile bare, and nothing else', async () => {
    const result = await runCliInHarness(['current'], {
      env: {
        CCP_ACTIVE_PROFILE: 'work',
        CCP_PROFILES_DIR: '/tmp/profiles',
        CLAUDE_CONFIG_DIR: '/tmp/profiles/work',
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('work\n');
    expect(result.stderr).toBe('');
  });
});

describe('current outside a Run', () => {
  it('says the Profile is unknown rather than guessing from CLAUDE_CONFIG_DIR', async () => {
    // A session started with bare `claude` under a hand-set CLAUDE_CONFIG_DIR
    // that happens to look like a Profile: the tool did not select it, so it
    // cannot claim it did.
    const result = await runCliInHarness(['current'], {
      env: { CLAUDE_CONFIG_DIR: '/tmp/profiles/work', CCP_PROFILES_DIR: '/tmp/profiles' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('unknown (not launched via ccprofile)\n');
    expect(result.stdout).not.toContain('work');
  });

  it('treats an empty CCP_ACTIVE_PROFILE as no Profile, not as a nameless one', async () => {
    const result = await runCliInHarness(['current'], { env: { CCP_ACTIVE_PROFILE: '' } });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('unknown (not launched via ccprofile)\n');
  });
});

describe('current with arguments it cannot act on', () => {
  it('rejects a Profile name, which it reports rather than selects', async () => {
    const result = await runCliInHarness(['current', 'work'], {
      env: { CCP_ACTIVE_PROFILE: 'personal' },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unexpected argument 'work'");
    expect(result.stdout).toBe('');
  });

  it('rejects an unknown option', async () => {
    const result = await runCliInHarness(['current', '--json'], {
      env: { CCP_ACTIVE_PROFILE: 'work' },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown option '--json'");
    expect(result.stdout).toBe('');
  });
});
