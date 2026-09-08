import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The default suite is the unit suite: no `claude` on PATH, no
    // credentials, no network. `test/integration/` is opted into explicitly
    // via `npm run test:integration`, because it needs Claude Code installed
    // and on PATH.
    include: ['test/**/*.test.ts'],
    exclude: ['test/integration/**'],
  },
});
