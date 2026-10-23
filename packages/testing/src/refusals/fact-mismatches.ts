import { isDeepStrictEqual } from 'node:util';
import { show } from '../scenarios/show';
import type { ExpectedFacts } from './expected-facts';

/** One sentence per expected fact the error does not carry with that value. */
export function factMismatches(error: unknown, expected: ExpectedFacts): string[] {
  const facts = factsOf(error);

  return Object.entries(expected).flatMap(([name, value]) => {
    if (!(name in facts)) {
      return [`fact ${name}: expected ${show(value)}, the refusal carries no such fact`];
    }

    return isDeepStrictEqual(facts[name], value)
      ? []
      : [`fact ${name}: expected ${show(value)}, got ${show(facts[name])}`];
  });
}

function factsOf(error: unknown): Readonly<Record<string, unknown>> {
  if (typeof error !== 'object' || error === null || !('facts' in error)) {
    return {};
  }

  const { facts } = error;

  return typeof facts === 'object' && facts !== null ? { ...facts } : {};
}
