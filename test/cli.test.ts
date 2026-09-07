import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { runCliInHarness } from './support/cli-harness.ts';

const { version: declaredVersion } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

describe('unknown command', () => {
  it('writes usage to stderr and exits 2', async () => {
    const result = await runCliInHarness(['wibble']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown command 'wibble'");
    expect(result.stderr).toContain('Usage: ccprofile');
    expect(result.stdout).toBe('');
    expect(result.launches).toEqual([]);
  });
});

describe('no command', () => {
  it('writes usage to stderr and exits 2, without inventing an empty command name', async () => {
    const result = await runCliInHarness([]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Usage: ccprofile');
    expect(result.stderr).not.toContain('unknown command');
    expect(result.stdout).toBe('');
  });
});

describe('--help', () => {
  it.each(['--help', '-h'])('writes usage to stdout and exits 0 for %s', async (flag) => {
    const result = await runCliInHarness([flag]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: ccprofile');
    expect(result.stdout).toContain('run [name]');
    expect(result.stderr).toBe('');
  });
});

describe('--version', () => {
  it.each(['--version', '-v'])(
    "writes the package's version to stdout and exits 0 for %s",
    async (flag) => {
      const result = await runCliInHarness([flag]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(`${declaredVersion}\n`);
      expect(result.stderr).toBe('');
    },
  );
});
