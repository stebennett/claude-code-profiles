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

/**
 * No Default Profile is set, which both `default` and a bare `run` report.
 * Neither can do anything about it, and both answers end in the same advice.
 */
export function noDefaultProfile(): string {
  return `ccprofile: no Default Profile set\nSet one with: ccprofile default <name>\n`;
}

/**
 * The Default Profile names a Profile that is no longer there. Worded away
 * from `profileNotFound` because the user named nothing: telling them a
 * Profile they did not type is missing would explain neither what happened nor
 * what to do about it.
 */
export function defaultProfileMissing(name: string, profilesRoot: string): string {
  return (
    `ccprofile: the Default Profile '${name}' is no longer in ${profilesRoot}\n` +
    `Set another with: ccprofile default <name>\n`
  );
}

/**
 * A name that is not a valid Profile name. The reason comes from
 * `profileNameError`, which every command asks and none words itself: the
 * prefix is the only part that was ever the command's, and it is identical in
 * all four.
 */
export function profileNameRejected(reason: string): string {
  return `ccprofile: ${reason}\n`;
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
