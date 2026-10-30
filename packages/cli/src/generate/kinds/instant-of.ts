import type { Name } from '../../naming';

/** The instant of a fact, in the words of the fact: `issuedAt` of `Issued`, `markedAsPaidAt` of `MarkedAsPaid`. */
export function instantOf(fact: Name): string {
  return `${fact.camel}At`;
}
