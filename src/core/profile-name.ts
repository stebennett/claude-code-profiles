/** The maximum length of a Profile name. */
const MAX_LENGTH = 64;

/**
 * Reserved because a Run with no name selects the Default Profile: a Profile
 * called `default` could not be told apart from that.
 */
const RESERVED = ['default'];

/**
 * A Profile name is one path segment, so the shape alone rules out separators,
 * `.` and `..` — there is no second check to keep in step with this one.
 */
const SHAPE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Explains why a name is not a valid Profile name, or `undefined` if it is.
 * See docs/spec.md, "Profile names".
 */
export function profileNameError(name: string): string | undefined {
  if (RESERVED.includes(name)) {
    return `'${name}' is a reserved name`;
  }

  if (name.length > MAX_LENGTH) {
    return `'${name}' is longer than ${String(MAX_LENGTH)} characters`;
  }

  if (!SHAPE.test(name)) {
    return `'${name}' is not a valid Profile name: use lower-case letters, digits and hyphens, starting with a letter or digit`;
  }

  return undefined;
}
