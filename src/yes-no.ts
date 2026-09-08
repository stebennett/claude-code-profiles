/**
 * Reads a typed answer to a `y/N` prompt.
 *
 * Pure, and so out here rather than inside `process-deps.ts`, because this is
 * the whole of "the prompt defaults to no": every answer that is not plainly
 * yes — Enter alone, a typo, an answer to some other question — declines. The
 * thing being protected is configuration the user set deliberately, so
 * guessing in the other direction is the one mistake that costs them anything.
 */
export function saidYes(answer: string): boolean {
  return /^y(es)?$/i.test(answer.trim());
}
