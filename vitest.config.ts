import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The default suite is the unit suite: no `claude` on PATH, no
    // credentials, no network, nothing built. The other two are opted into
    // explicitly — `test/integration/` via `npm run test:integration` because
    // it needs Claude Code installed and on PATH, and `test/package/` via
    // `npm run test:package` because it packs and installs the package.
    include: ['test/**/*.test.ts'],
    exclude: ['test/integration/**', 'test/package/**'],
  },
});
