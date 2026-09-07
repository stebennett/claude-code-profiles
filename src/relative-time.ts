const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago, in the units a reader can act on: the `list` column exists to
 * be skimmed, so "3 days ago" beats a timestamp to compare against by hand.
 * A month is taken as 30 days and a year as 365, which is what makes the
 * larger buckets approximate — they are read as "a while back", not arithmetic.
 */
const UNITS: readonly { readonly limit: number; readonly size: number; readonly name: string }[] = [
  { limit: HOUR, size: MINUTE, name: 'minute' },
  { limit: DAY, size: HOUR, name: 'hour' },
  { limit: 30 * DAY, size: DAY, name: 'day' },
  { limit: 365 * DAY, size: 30 * DAY, name: 'month' },
  { limit: Infinity, size: 365 * DAY, name: 'year' },
];

/**
 * Renders how long before `now` something happened, in words.
 *
 * Anything under a minute — and anything apparently in the future, which a
 * clock the tool does not own can produce — reads as `just now` rather than
 * as a negative or a zero.
 */
export function relativeTime(then: Date, now: Date): string {
  const elapsed = now.getTime() - then.getTime();
  if (elapsed < MINUTE) return 'just now';

  for (const { limit, size, name } of UNITS) {
    if (elapsed >= limit) continue;

    const count = Math.floor(elapsed / size);
    return `${String(count)} ${name}${count === 1 ? '' : 's'} ago`;
  }

  // Unreachable: the last unit's limit is Infinity.
  return 'just now';
}
