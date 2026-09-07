import { readClaudeJson } from '../core/claude-json.ts';
import { listProfileNames, profilePath } from '../core/profiles.ts';
import { resolveProfilesRoot } from '../core/profiles-root.ts';
import type { CliDeps } from '../deps.ts';
import { EXIT_OK, EXIT_USAGE } from '../exit-codes.ts';
import { unknownOption } from '../messages.ts';
import { relativeTime } from '../relative-time.ts';

const JSON_FLAG = '--json';

/** What a Profile with no Profile Identity shows in the account column. */
const NOT_LOGGED_IN = '(not logged in)';

/** What a Profile that has never been Run shows in the last-used column. */
const NEVER = 'never';

/** What a Profiles Root with nothing in it prints. */
const EMPTY = 'No Profiles yet.\nCreate one with: ccprofile new <name>\n';

const HEADINGS = ['NAME', 'ACCOUNT', 'LAST USED'] as const;

/** The gap between columns, wide enough to read as a gap rather than a space. */
const GAP = '  ';

/** One Profile, before either output format has had its say. */
interface Row {
  name: string;
  path: string;
  identity: string | undefined;
  lastUsed: Date | undefined;
}

/** Lists every Profile. See docs/spec.md, "`ccprofile list`". */
export async function list(argv: readonly string[], deps: CliDeps): Promise<number> {
  const asJson = argv.includes(JSON_FLAG);

  const [unexpected] = argv.filter((argument) => argument !== JSON_FLAG);
  if (unexpected !== undefined) {
    if (unexpected.startsWith('-')) {
      deps.stderr(unknownOption(unexpected));
      return EXIT_USAGE;
    }

    // Refused rather than dropped: a name here is a `path` or a `run`, and
    // listing everything would look like it had been honoured and ignored.
    deps.stderr(
      `ccprofile: unexpected argument '${unexpected}'\n` +
        `list shows every Profile; for one, use: ccprofile path ${unexpected}\n`,
    );
    return EXIT_USAGE;
  }

  const profilesRoot = resolveProfilesRoot(deps);
  const rows = await collect(profilesRoot);

  deps.stdout(asJson ? renderJson(rows) : renderTable(rows, deps.now()));
  return EXIT_OK;
}

/** Reads every Profile's name, Identity and last-used time. */
async function collect(profilesRoot: string): Promise<Row[]> {
  const names = await listProfileNames(profilesRoot);

  return Promise.all(
    names.map(async (name) => {
      const path = profilePath(profilesRoot, name);
      return { name, path, ...(await readClaudeJson(path)) };
    }),
  );
}

/**
 * The machine-readable form. An absent Identity or last-used time is `null`
 * rather than the human placeholder, so nothing has to parse
 * `(not logged in)` to learn that a Profile has no account.
 */
function renderJson(rows: readonly Row[]): string {
  const entries = rows.map(({ name, path, identity, lastUsed }) => ({
    name,
    path,
    account: identity ?? null,
    lastUsed: lastUsed?.toISOString() ?? null,
  }));

  return `${JSON.stringify(entries, null, 2)}\n`;
}

/**
 * The human form: one aligned row per Profile, under a heading row. With no
 * Profiles there is nothing to align, and a lone heading row would read as
 * though the listing had failed, so it says so and points at `new` instead.
 */
function renderTable(rows: readonly Row[], now: Date): string {
  if (rows.length === 0) return EMPTY;

  const cells = rows.map(({ name, identity, lastUsed }) => [
    name,
    identity ?? NOT_LOGGED_IN,
    lastUsed === undefined ? NEVER : relativeTime(lastUsed, now),
  ]);

  return table([[...HEADINGS], ...cells]);
}

/**
 * Renders rows in aligned columns. The last cell is never padded, so no line
 * carries trailing whitespace into a terminal or a pipe.
 */
function table(rows: readonly string[][]): string {
  const widths = rows[0]?.map((_cell, column) =>
    Math.max(...rows.map((row) => (row[column] ?? '').length)),
  );

  return rows
    .map(
      (row) =>
        `${row
          .map((cell, column) =>
            column === row.length - 1 ? cell : cell.padEnd(widths?.[column] ?? 0),
          )
          .join(GAP)}\n`,
    )
    .join('');
}
