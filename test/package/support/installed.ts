import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';

import { type Spawned, spawnCapturing } from '../../support/spawn.ts';

/** The repository root, which is the package `npm pack` is run against. */
const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * The fields of the installed `package.json` this suite has something to say
 * about. Declared rather than left as `unknown` so the assertions read as
 * field accesses; a field npm did not publish arrives as `undefined` and the
 * assertion fails, which is the point.
 */
export interface Manifest {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  license: string;
  type: string;
  bin: Record<string, string>;
  engines: Record<string, string>;
  files: string[];
  repository: { type: string; url: string };
}

/** The part of `npm pack --json` that matters here. */
interface PackReport {
  filename: string;
  files: { path: string }[];
}

/**
 * The package as a user receives it: packed into a tarball, then installed
 * globally into a prefix of our own.
 *
 * The prefix is a temporary directory rather than the machine's, so running
 * this suite cannot install over a `ccprofile` the user has, and needs no
 * write access to `/usr/local`. It is the same `npm install -g` code path
 * either way — only the destination differs — so what it proves about the
 * published package holds for a real global install.
 *
 * Where in a prefix npm puts things is read as the POSIX layout, `bin/` and
 * `lib/node_modules/`, which is the platform pair 1.0 supports; Windows lays a
 * prefix out differently and is out of scope (`docs/spec.md`, Package).
 */
export interface Installed {
  /** The temporary directory holding all of it, and the only thing to remove. */
  root: string;
  /** The tarball itself, as `npm publish` would upload it. */
  tarball: string;
  /** Every path inside the tarball, relative to the package root. */
  files: string[];
  /** The `package.json` that was installed, read back from the install. */
  manifest: Manifest;
  /** The directory the installed `ccprofile` binary is in, to put on PATH. */
  binDir: string;
  /** Stands in for `$HOME`, so no child of this suite reads the user's. */
  home: string;
}

/**
 * Packs the package and installs it, returning both what the tarball contains
 * and where the installed binary landed.
 *
 * `npm pack` is what runs `prepack`, so the tarball is built from the current
 * source rather than whatever `dist/` happened to hold — the same guarantee
 * `npm publish` relies on.
 */
export async function givenInstalledPackage(): Promise<Installed> {
  const root = await mkdtemp(join(tmpdir(), 'ccprofile-package-'));
  const prefix = join(root, 'prefix');
  const home = join(root, 'home');
  await mkdir(home);

  const packed = await npm(['pack', '--json', '--pack-destination', root]);
  const report = (JSON.parse(firstJsonArray(packed.stdout)) as PackReport[])[0];
  if (!report) throw new Error(`npm pack reported nothing:\n${packed.stdout}`);

  const tarball = join(root, report.filename);
  await npm(['install', '--global', '--prefix', prefix, tarball]);

  const manifest = JSON.parse(
    await readFile(join(prefix, 'lib', 'node_modules', 'ccprofile', 'package.json'), 'utf8'),
  ) as Manifest;

  return {
    root,
    tarball,
    files: report.files.map((file) => file.path),
    manifest,
    binDir: join(prefix, 'bin'),
    home,
  };
}

export async function removeInstalledPackage(installed: Installed): Promise<void> {
  await rm(installed.root, { recursive: true, force: true });
}

/**
 * Runs `ccprofile` the way a user with it on PATH does — by bare name, found
 * through PATH rather than by absolute path, because "exposes a working
 * `ccprofile` on PATH" is the claim.
 */
export function runOnPath(
  installed: Installed,
  args: string[],
  extraEnv: Record<string, string> = {},
): Promise<Spawned> {
  return spawnCapturing('ccprofile', args, {
    env: { ...childEnv(installed, `${installed.binDir}${delimiter}`), ...extraEnv },
  });
}

/**
 * Runs the tarball through `npx`, which is the other install route the README
 * offers. Before a publish this is as close as it gets: `npx <name>` fetches
 * the tarball for the name and then does exactly this.
 *
 * `--package` names the tarball and `ccprofile` the command to run out of it,
 * rather than `npx <tarball>`, which npx reads as a local executable to run
 * and refuses. Naming the command has the better shape here anyway: it is the
 * `bin` entry being resolved, which is what `npx ccprofile` relies on.
 */
export function runViaNpx(installed: Installed, args: string[]): Promise<Spawned> {
  return spawnCapturing('npx', ['--yes', '--package', installed.tarball, 'ccprofile', ...args], {
    env: childEnv(installed, ''),
  });
}

/**
 * A Profiles Root of our own, so a command that writes can be run against the
 * installed binary without touching the user's Profiles.
 */
export async function givenProfilesRoot(installed: Installed): Promise<string> {
  return await mkdtemp(join(installed.root, 'profiles-'));
}

/**
 * What a child of this suite may see: enough to find `node`, and a home of our
 * own. Built rather than inherited so that a `CLAUDE_CONFIG_DIR` or
 * `CCP_PROFILES_DIR` in the terminal running the suite cannot decide an
 * outcome — including the outcome of the commands here that name no Profiles
 * Root of their own.
 */
function childEnv(installed: Installed, pathPrefix: string): NodeJS.ProcessEnv {
  return {
    PATH: `${pathPrefix}${process.env.PATH ?? ''}`,
    HOME: installed.home,
  };
}

async function npm(args: string[]): Promise<Spawned> {
  const result = await spawnCapturing('npm', [...args, '--no-audit', '--no-fund'], {
    cwd: PACKAGE_ROOT,
    env: process.env,
  });
  if (result.code !== 0) {
    throw new Error(`npm ${args.join(' ')} failed (${String(result.code)}):\n${result.stderr}`);
  }
  return result;
}

/**
 * npm's `--json` output can be preceded by other lines — a notice about a new
 * npm version, most often — so the array is found rather than assumed to start
 * at byte zero.
 */
function firstJsonArray(output: string): string {
  const start = output.indexOf('[');
  if (start === -1) throw new Error(`no JSON array in npm output:\n${output}`);
  return output.slice(start);
}
