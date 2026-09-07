/**
 * The `errno` code on a Node system error, or `undefined` for anything else.
 * The cast is the only way to ask: `catch` gives `unknown`, and the codes are
 * not declared on `Error`.
 */
export function errnoCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

/**
 * Whether a filesystem error means "there is nothing there", the one failure
 * this tool reads as an answer rather than reporting: a Profiles Root not yet
 * created, a Profile that is not there, a `.claude.json` never written.
 *
 * ENOTDIR belongs with ENOENT because a path component that is a file means
 * nothing can exist beneath it either. Everything else — a directory we may
 * not read, say — is a real failure and stays a throw at the call site.
 */
export function isMissing(error: unknown): boolean {
  const code = errnoCode(error);
  return code === 'ENOENT' || code === 'ENOTDIR';
}
