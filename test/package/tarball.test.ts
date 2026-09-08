import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  givenInstalledPackage,
  givenProfilesRoot,
  type Installed,
  removeInstalledPackage,
  runOnPath,
  runViaNpx,
} from './support/installed.ts';

/**
 * What #17 promises: the published package installs and runs. Everything here
 * is asserted against a tarball `npm pack` produced and then installed, rather
 * than against the working tree, because that tarball is what a user gets and
 * `files` decides what is in it.
 *
 * This suite is opted into (`npm run test:package`) but, unlike the
 * integration suite, it does run in CI: the matrix is the only honest way to
 * claim the package installs and runs on both macOS and Linux. It needs no
 * `claude`, no Claude account and no network beyond npm itself — nothing here
 * launches Claude Code.
 *
 * Packing and installing is slow and identical for every assertion, so it
 * happens once for the file.
 */

/** What npm puts in a tarball whatever `files` says, and a user does read. */
const ALWAYS_PUBLISHED = ['package.json', 'README.md', 'LICENSE'];

let installed: Installed;

beforeAll(async () => {
  installed = await givenInstalledPackage();
}, 180_000);

afterAll(async () => {
  await removeInstalledPackage(installed);
});

describe('the published package metadata', () => {
  it('carries everything npm and a reader need', () => {
    const { manifest } = installed;

    expect(manifest.name).toBe('ccprofile');
    expect(manifest.type).toBe('module');
    expect(manifest.license).toBe('MIT');
    expect(manifest.bin).toEqual({ ccprofile: 'dist/bin.js' });
    expect(manifest.engines).toEqual({ node: '>=22' });
    expect(manifest.files).toEqual(['dist']);
    expect(manifest.description).toContain('Claude Code');
    expect(manifest.keywords).toContain('claude-code');
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/stebennett/claude-code-profiles.git',
    });
  });

  it('is the 1.x the spec scopes, rather than the scaffold 0.0.0', () => {
    expect(installed.manifest.version).toMatch(/^1\./);
  });
});

describe('the published tarball', () => {
  it('holds the built entry point, and the licence and README npm shows', () => {
    expect(installed.files).toEqual(
      expect.arrayContaining(['package.json', 'README.md', 'LICENSE', 'dist/bin.js']),
    );
  });

  it('holds nothing a user does not need to run it', () => {
    // Stated as an allowlist rather than a list of what must not appear: a new
    // top-level file would slip past the second form, and source, tests, docs
    // and build configuration are all on GitHub, where anyone reading them is
    // better served anyway.
    const extra = installed.files.filter(
      (file) => !file.startsWith('dist/') && !ALWAYS_PUBLISHED.includes(file),
    );

    expect(extra).toEqual([]);
  });

  it('ships no declarations, which nothing could import', () => {
    // The package has a `bin` and no `exports`, so nothing outside it can
    // reach the module seam. Source maps do ship: a stack trace in a bug
    // report is worth the bytes.
    expect(installed.files.filter((file) => file.endsWith('.d.ts'))).toEqual([]);
  });
});

describe('the globally installed ccprofile', () => {
  it('prints its usage when found on PATH', async () => {
    const result = await runOnPath(installed, ['--help']);

    expect(result.stdout).toContain('Usage: ccprofile <command> [options]');
    expect(result.code).toBe(0);
  });

  it('reports the version of the package that was installed', async () => {
    const result = await runOnPath(installed, ['--version']);

    expect(result.stdout.trim()).toBe(installed.manifest.version);
    expect(result.code).toBe(0);
  });

  it('creates and lists a Profile', async () => {
    // A command that reads and writes the filesystem, so that what is proven
    // is the built code doing its work — not just the argv front door. It
    // runs against a Profiles Root of our own, and `--no-launch` is what
    // keeps it from needing a `claude` at all.
    const profilesRoot = await givenProfilesRoot(installed);
    const env = { CCP_PROFILES_DIR: profilesRoot };

    const created = await runOnPath(installed, ['new', 'packaged', '--no-launch'], env);
    const listed = await runOnPath(installed, ['list'], env);

    expect(created.code, created.stderr).toBe(0);
    expect(listed.stdout).toContain('packaged');
    expect(listed.code).toBe(0);
    expect((await stat(join(profilesRoot, 'packaged'))).isDirectory()).toBe(true);
  });
});

describe('the package run through npx', () => {
  // The README offers `npx ccprofile` as well as a global install, so it is
  // worth the same proof. Naming the tarball is as close as it gets before a
  // publish, and it is close: `npx <name>` fetches the tarball and then does
  // exactly this.
  it('prints its usage', async () => {
    const result = await runViaNpx(installed, ['--help']);

    expect(result.stdout).toContain('Usage: ccprofile <command> [options]');
    expect(result.code).toBe(0);
  });
});
