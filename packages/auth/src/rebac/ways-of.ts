import type { DerivedRelation } from './derived-relation.js';
import type { Way } from './via.js';
import type { Ways } from './ways.js';

/** The ways of a derived relation, every list present: a single way is `anyOf` it alone. */
export function waysOf(derived: DerivedRelation): Required<Ways> {
  if (isWay(derived)) {
    return { anyOf: [derived], allOf: [], butNot: [] };
  }

  return { anyOf: derived.anyOf ?? [], allOf: derived.allOf ?? [], butNot: derived.butNot ?? [] };
}

function isWay(derived: DerivedRelation): derived is Way {
  return typeof derived === 'string' || 'via' in derived;
}
