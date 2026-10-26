import { describe, expect, it } from 'vitest';
import { coverOf, EVERY_STACK, RUNNABLE, STACKS } from './e2e/stacks';
import { DEFAULT_STACK, type StackFlags } from './helpers';

const valuesOf = (stacks: readonly StackFlags[]): Set<string> =>
  new Set(stacks.flatMap((stack) => Object.entries(stack).map(([flag, value]) => `${flag}=${String(value)}`)));

describe('the cover of the stacks a pull request generates', () => {
  it('holds every value of every flag the stacks name, in far fewer stacks', () => {
    const cover = coverOf(EVERY_STACK);

    expect(valuesOf(cover)).toEqual(valuesOf(EVERY_STACK));
    expect(cover.length).toBeLessThanOrEqual(EVERY_STACK.length / 2);
    expect(cover.every((stack) => EVERY_STACK.includes(stack))).toBe(true);
  });

  it('counts the default of a flag a stack leaves out as a value of its own', () => {
    const named: StackFlags = { ...DEFAULT_STACK, broker: 'nats' };
    const cover = coverOf([DEFAULT_STACK, named]);

    expect(cover).toEqual([DEFAULT_STACK, named]);
  });

  it('keeps the first of two stacks that bring the same values, so that the cover does not move between runs', () => {
    expect(coverOf([DEFAULT_STACK, { ...DEFAULT_STACK }])).toEqual([DEFAULT_STACK]);
    expect(coverOf(EVERY_STACK)).toEqual(coverOf(EVERY_STACK));
  });

  it('is empty for no stack', () => {
    expect(coverOf([])).toEqual([]);
  });

  it('is not applied outside a pull request: every stack is generated where nothing is handed over', () => {
    expect(STACKS).toBe(EVERY_STACK);
    expect(RUNNABLE.length).toBeGreaterThan(40);
  });
});
