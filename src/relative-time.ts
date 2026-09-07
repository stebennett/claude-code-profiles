const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago, in the units a reader can act on: the `list` column exists to
 * be skimmed, so "3 days ago" beats a timestamp to compare against by hand.
 * A month is taken as 30 days and a year as 365, which is what makes the
 * larger buckets approximate — they are read as "a while back", not arithmetic.
 */
const UNITS = [
  { limit: HOUR, size: MINUTE, name: 'minute' },
  { limit: DAY, size: HOUR, name: 'hour' },
  { limit: 30 * DAY, size: DAY, name: 'day' },
  { limit: 365 * DAY, size: 30 * DAY, name: 'month' },
] as const;

/** The unit for anything the table above does not reach, and so unbounded. */
const YEARS = { size: 365 * DAY, name: 'year' } as const;

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

  const { size, name } = UNITS.find(({ limit }) => elapsed < limit) ?? YEARS;
  const count = Math.floor(elapsed / size);

  return `${String(count)} ${name}${count === 1 ? '' : 's'} ago`;
}
