import { defineConfig } from 'vitest/config';

/**
 * The packaging suite: it packs the package and installs it globally into a
 * throwaway prefix, so it is too slow to sit in the default suite but does
 * belong in CI, where the matrix is what makes "installs and runs on macOS and
 * Linux" a fact.
 */
export default defineConfig({
  test: {
    include: ['test/package/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
