import { profilePath } from './profiles.ts';

/** The Profile a Run selected, and the environment it was selected from. */
export interface RunTarget {
  env: Readonly<Record<string, string | undefined>>;
  /** Absolute path to the Profiles Root, already resolved. */
  profilesRoot: string;
  name: string;
}

/**
 * Builds the environment a Run launches `claude` with: everything inherited,
 * plus exactly the three variables in docs/spec.md, "Environment contract".
 *
 * `CCP_PROFILES_DIR` carries the *resolved* root, so a `ccprofile` invoked from
 * inside the session inherits an explicit root rather than re-deriving one from
 * the `CLAUDE_CONFIG_DIR` we are about to set.
 */
export function buildChildEnv({ env, profilesRoot, name }: RunTarget): Record<string, string> {
  const inherited: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    // An unset variable is absent, not empty; passing it on as `''` would
    // change its meaning for the child.
    if (value !== undefined) inherited[key] = value;
  }

  return {
    ...inherited,
    CLAUDE_CONFIG_DIR: profilePath(profilesRoot, name),
    CCP_PROFILES_DIR: profilesRoot,
    CCP_ACTIVE_PROFILE: name,
  };
}
