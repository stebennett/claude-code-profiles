import { buildChildEnv } from '../core/child-env.ts';
import { profileNameError } from '../core/profile-name.ts';
import { profileExists, profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import { readDefaultProfile } from '../core/tool-state.ts';
import type { CliDeps } from '../deps.ts';
import { errnoCode } from '../errno.ts';
import { EXIT_FAILED, EXIT_USAGE } from '../exit-codes.ts';
import {
  defaultProfileMissing,
  noDefaultProfile,
  profileNameRejected,
  profileNotFound,
  unexpectedArgument,
  unknownOption,
} from '../messages.ts';

/** Both spellings of the bypass for the `CLAUDE_CONFIG_DIR` prompt. */
const YES_OPTIONS = ['--yes', '-y'];

/** Runs Claude Code under a Profile. See docs/spec.md, "`ccprofile run`". */
export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  const { own, forwarded } = splitAtDoubleDash(argv);

  // Only our own arguments: a `-y` after `--` is Claude Code's, and reading it
  // here would silently answer a question the user meant to forward.
  const assumeYes = own.some((argument) => YES_OPTIONS.includes(argument));
  const positional = own.filter((argument) => !YES_OPTIONS.includes(argument));

  // Every argument check here is about a name the user typed; with none there
  // is nothing to refuse, since a second argument cannot arrive without a
  // first. Nesting them says that, rather than each restating it.
  const [named, unexpected, ...rest] = positional;
  if (named !== undefined) {
    if (named.startsWith('-')) {
      deps.stderr(unknownOption(named));
      return EXIT_USAGE;
    }
    if (unexpected !== undefined) {
      const forClaude = [unexpected, ...rest].join(' ');
      deps.stderr(
        unexpectedArgument(
          unexpected,
          `Pass Claude Code's own arguments after --, as: ccprofile run ${named} -- ${forClaude}\n`,
        ),
      );
      return EXIT_USAGE;
    }

    const nameError = profileNameError(named);
    if (nameError !== undefined) {
      deps.stderr(profileNameRejected(nameError));
      return EXIT_USAGE;
    }
  }

  const profilesRoot = resolveProfilesRoot(deps);

  // With no name, the Default Profile (ADR-0003). A name recorded in tool
  // state has already been held to `profileNameError` on the way out of it, so
  // only the typed one is checked above.
  const name = named ?? (await readDefaultProfile(profilesRoot));
  if (name === undefined) {
    deps.stderr(noDefaultProfile());
    return EXIT_FAILED;
  }

  // A Run never creates: a mistyped name would otherwise leave an empty,
  // unauthenticated Profile and an unexplained login prompt.
  if (!(await profileExists(profilePath(profilesRoot, name)))) {
    // Which message depends on who chose the name. `ccprofile new work` is the
    // fix for a name the user typed; for one they did not, it would be advice
    // about a Profile they never asked for.
    deps.stderr(
      named === undefined
        ? defaultProfileMissing(name, profilesRoot)
        : profileNotFound(name, profilesRoot),
    );
    return EXIT_FAILED;
  }

  // A `CLAUDE_CONFIG_DIR` the user set is someone's deliberate setup, so a Run
  // asks before overriding it. `CCP_ACTIVE_PROFILE` is what tells a variable we
  // set from one they did: with it present the value is ours, and questioning
  // the user about our own doing would make the prompt routine, and so unread.
  //
  // An empty value is unset here as it is everywhere else in the tool, which
  // leaves no path to warn about overriding.
  const userConfigDir = deps.env.CLAUDE_CONFIG_DIR ?? '';
  const userSet = userConfigDir !== '' && deps.env.CCP_ACTIVE_PROFILE === undefined;

  if (
    userSet &&
    !assumeYes &&
    !(await consentToOverride(deps, userConfigDir, profilesRoot, name))
  ) {
    return EXIT_FAILED;
  }

  try {
    return await deps.launch('claude', forwarded, buildChildEnv({ env: deps.env, profilesRoot, name }));
  } catch (error) {
    // The one launch failure worth advice: everything else is reported as it
    // came, since guessing at a cause would only obscure it.
    if (errnoCode(error) !== 'ENOENT') throw error;

    deps.stderr(
      `ccprofile: could not run 'claude'\n` +
        `Claude Code must be installed and on your PATH: https://claude.com/claude-code\n`,
    );
    return EXIT_FAILED;
  }
}

/**
 * Warns what a Run is about to override, and answers whether to go ahead.
 *
 * The prompt defaults to no, so an unconsidered keypress cannot discard a
 * deliberate setup. Without a terminal there is nobody to answer it, so the
 * Run fails naming the bypass rather than hanging on a prompt that can never
 * be read or assuming an answer the user did not give.
 */
async function consentToOverride(
  deps: CliDeps,
  userConfigDir: string,
  profilesRoot: string,
  name: string,
): Promise<boolean> {
  // Both refusals continue this block, so `ccprofile:` leads the warning and
  // nothing after it — the prefix marks where the tool started speaking, not
  // every line it says.
  deps.stderr(
    `ccprofile: CLAUDE_CONFIG_DIR is set to ${userConfigDir}\n` +
      `This Run overrides it with the Profile '${name}' at ${profilePath(profilesRoot, name)}\n`,
  );

  if (!deps.isTTY) {
    deps.stderr(
      `No terminal to confirm on, so nothing was launched.\n` +
        `Re-run with --yes to override it.\n`,
    );
    return false;
  }

  if (await deps.confirm('Override it?')) return true;

  deps.stderr(`Nothing launched; CLAUDE_CONFIG_DIR left as it is.\n`);
  return false;
}

/**
 * Splits our own arguments from Claude Code's. Only the first `--` separates;
 * any later one belongs to `claude`, so it is forwarded verbatim.
 */
function splitAtDoubleDash(argv: readonly string[]): {
  own: readonly string[];
  forwarded: readonly string[];
} {
  const separator = argv.indexOf('--');
  if (separator === -1) return { own: argv, forwarded: [] };

  return { own: argv.slice(0, separator), forwarded: argv.slice(separator + 1) };
}
