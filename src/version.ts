import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Read from `package.json` rather than duplicated in source, so `npm version`
 * remains the single place a release is stamped. This module sits one
 * directory below the package root both in `src/` and in the built `dist/`.
 */
export function packageVersion(): string {
  const { version } = require('../package.json') as { version: string };
  return version;
}
