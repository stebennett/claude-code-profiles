import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Creates a Profile the way a user would: a directory in the Profiles Root and
 * nothing else (ADR-0002). Returns its path, which is what a test asserts on.
 */
export async function givenProfile(root: string, name: string): Promise<string> {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  return dir;
}
