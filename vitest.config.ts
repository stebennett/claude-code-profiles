import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The default suite is the unit suite: no `claude` on PATH, no
    // credentials, no network. `test/integration/` is opted into explicitly
    // via `npm run test:integration`, because it needs a real `claude` and
    // depends on the machine. See issue #7.
    include: ['test/**/*.test.ts'],
    exclude: ['test/integration/**'],
  },
});
