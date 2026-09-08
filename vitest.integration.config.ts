import { defineConfig } from 'vitest/config';

/**
 * The integration suite, opted into explicitly and kept out of CI: it needs
 * Claude Code installed and on PATH. It needs no Claude account — everything
 * it asserts happens before Claude Code asks for one.
 */
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    passWithNoTests: true,
    testTimeout: 60_000,
  },
});
