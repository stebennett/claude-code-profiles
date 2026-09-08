import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** The repository root, which is the package `npm pack` is run against. */
const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** What a child process said. */
export interface Output {
  stdout: string;
  stderr: string;
  code: number | null;
}

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
 */
export interface Installed {
  /** The temporary directory holding tarball and prefix; the only thing to remove. */
  root: string;
  /** The tarball itself, as `npm publish` would upload it. */
  tarball: string;
  /** Every path inside the tarball, relative to the package root. */
  files: string[];
  /** The `package.json` that was installed, read back from the install. */
  manifest: Manifest;
  /** The directory the installed `ccprofile` binary is in, to put on PATH. */
  binDir: string;
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

  const packed = await npm(['pack', '--json', '--pack-destination', root]);
  const report = (JSON.parse(firstJsonValue(packed.stdout)) as PackReport[])[0];
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
  };
}

export async function removeInstalledPackage(installed: Installed): Promise<void> {
  await rm(installed.root, { recursive: true, force: true });
}

/**
 * Runs `ccprofile` the way a user with it on PATH does — by bare name, found
 * through PATH rather than by absolute path, because "exposes a working
 * `ccprofile` on PATH" is the claim.
 *
 * PATH is the installed prefix followed by the inherited one: `node` has to
 * stay findable for the shebang to resolve.
 */
export async function runOnPath(
  installed: Installed,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): Promise<Output> {
  return await run('ccprofile', args, {
    ...process.env,
    ...env,
    PATH: `${installed.binDir}:${process.env.PATH ?? ''}`,
  });
}

/**
 * A Profiles Root of our own, so a command that writes can be run against the
 * installed binary without touching the user's Profiles.
 */
export async function givenProfilesRoot(installed: Installed): Promise<string> {
  return await mkdtemp(join(installed.root, 'profiles-'));
}

async function npm(args: string[]): Promise<Output> {
  const result = await run('npm', [...args, '--no-audit', '--no-fund'], process.env, PACKAGE_ROOT);
  if (result.code !== 0) {
    throw new Error(`npm ${args.join(' ')} failed (${String(result.code)}):\n${result.stderr}`);
  }
  return result;
}

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd?: string,
): Promise<Output> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      ...(cwd === undefined ? {} : { cwd }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

/**
 * npm's `--json` output can be preceded by other lines — a notice about a new
 * npm version, most often — so the array is found rather than assumed to start
 * at byte zero.
 */
function firstJsonValue(output: string): string {
  const start = output.indexOf('[');
  if (start === -1) throw new Error(`no JSON in npm output:\n${output}`);
  return output.slice(start);
}
