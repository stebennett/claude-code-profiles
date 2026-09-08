import { describe, expect, it } from 'vitest';

import { saidYes } from '../src/yes-no.ts';

/**
 * The one thing tested off the `runCli` seam, because `confirm` is faked
 * there: this is where "the prompt defaults to no" actually lives, and the
 * setup it protects is too costly to leave to prose.
 */
describe('saidYes', () => {
  it.each(['y', 'Y', 'yes', 'YES', 'Yes', ' y ', 'y\n'])('reads %j as yes', (answer) => {
    expect(saidYes(answer)).toBe(true);
  });

  it.each([
    ['an empty answer, which is what Enter alone sends', ''],
    ['whitespace', '   '],
    ['n', 'n'],
    ['no', 'no'],
    // Anything unrecognised is a no: the cost of guessing wrong here is
    // someone's deliberate configuration.
    ['a typo of yes', 'yse'],
    ['a word starting with y', 'yellow'],
    ['an answer to a different question', 'ok'],
    ['1', '1'],
  ])('reads %s as no', (_description, answer) => {
    expect(saidYes(answer)).toBe(false);
  });
});
