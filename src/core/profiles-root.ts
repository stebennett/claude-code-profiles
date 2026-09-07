import { join, resolve } from 'node:path';

/** The process state the Profiles Root is derived from. */
export interface RootContext {
  env: Readonly<Record<string, string | undefined>>;
  cwd: string;
  homeDir: string;
}

/**
 * Resolves the Profiles Root to an absolute path. See docs/spec.md,
 * "Profiles Root resolution".
 */
export function resolveProfilesRoot({ env, cwd, homeDir }: RootContext): string {
  const configured = env.CCP_PROFILES_DIR;
  if (configured !== undefined && configured !== '') {
    return resolve(cwd, configured);
  }

  const configDir = env.CLAUDE_CONFIG_DIR;
  if (configDir !== undefined && configDir !== '') {
    return resolve(cwd, configDir, 'profiles');
  }

  return join(homeDir, '.claude', 'profiles');
}
