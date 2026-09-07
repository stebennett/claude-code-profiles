/**
 * The `errno` code on a Node system error, or `undefined` for anything else.
 * The cast is the only way to ask: `catch` gives `unknown`, and the codes are
 * not declared on `Error`.
 */
export function errnoCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}
