import { USAGE } from './usage.ts';

/**
 * The stderr text more than one command needs, verbatim. Only the wording that
 * is genuinely the same everywhere lives here: the argument checks around it
 * read alike but say different things per command, and giving each command its
 * own wording is what keeps these messages worth sharing.
 */

/** A Profile the user named is not in the Profiles Root. */
export function profileNotFound(name: string, profilesRoot: string): string {
  return (
    `ccprofile: no Profile named '${name}' in ${profilesRoot}\n` +
    `Create it with: ccprofile new ${name}\n`
  );
}

/** An argument in a Profile name's place that is plainly an option instead. */
export function unknownOption(option: string): string {
  return `ccprofile: unknown option '${option}'\n\n${USAGE}`;
}

/** A command that takes a Profile name was given none. */
export function requiresProfileName(command: string): string {
  return `ccprofile: ${command} requires a Profile name\n\n${USAGE}`;
}

/**
 * An argument no command can place. Every command refuses one rather than
 * dropping it, and each says something different about why — `run` names the
 * `--` form, `new` creates one Profile at a time, `path` prints one, `current`
 * reports rather than selects, `list` shows every Profile — so `advice` stays
 * the caller's and only the line that is identical in all five lives here.
 */
export function unexpectedArgument(argument: string, advice: string): string {
  return `ccprofile: unexpected argument '${argument}'\n${advice}`;
}
