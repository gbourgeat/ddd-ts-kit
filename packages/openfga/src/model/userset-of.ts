import type { Rewrite } from '@ddd-ts-kit/auth/rebac';
import type { OpenFgaUserset } from './open-fga-model.js';

/**
 * A rewrite of the relationship schema in the words of OpenFGA: a name is a computed userset,
 * `from` a tuple to userset, `exclusion` a difference; union and intersection keep their name.
 */
export function usersetOf(rewrite: Rewrite): OpenFgaUserset {
  if (typeof rewrite === 'string') {
    return { computedUserset: { relation: rewrite } };
  }

  switch (rewrite.kind) {
    case 'from':
      return {
        tupleToUserset: {
          tupleset: { relation: rewrite.relation },
          computedUserset: { relation: rewrite.permission },
        },
      };
    case 'exclusion':
      return { difference: { base: usersetOf(rewrite.base), subtract: usersetOf(rewrite.subtract) } };
    case 'union':
      return { union: { child: rewrite.children.map(usersetOf) } };
    case 'intersection':
      return { intersection: { child: rewrite.children.map(usersetOf) } };
  }
}
