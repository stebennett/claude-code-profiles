import { defineConfig } from 'vitest/config';

/**
 * The integration suite, opted into explicitly and kept out of CI: it needs a
 * real `claude` on PATH and depends on the machine. Empty until issue #7.
 */
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    passWithNoTests: true,
    testTimeout: 60_000,
  },
});
