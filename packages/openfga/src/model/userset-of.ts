import { waysOf, type DerivedRelation, type Way } from '@ddd-ts-kit/auth/rebac';
import type { OpenFgaUserset } from './open-fga-model';
import { relationNameOf } from './relation-name-of';

/**
 * A derived relation of the schema in the words of OpenFGA: a name is a computed userset, `via`
 * a tuple to userset, `anyOf` a union, `allOf` an intersection, `butNot` a difference.
 */
export function usersetOf(derived: DerivedRelation): OpenFgaUserset {
  const { anyOf, allOf, butNot } = waysOf(derived);
  const required = [...(anyOf.length === 0 ? [] : [oneOf(anyOf)]), ...allOf.map(usersetOfWay)];
  const held = required.length === 1 && required[0] !== undefined ? required[0] : { intersection: { child: required } };

  return butNot.length === 0 ? held : { difference: { base: held, subtract: oneOf(butNot) } };
}

function oneOf(ways: readonly Way[]): OpenFgaUserset {
  const [first, ...others] = ways;

  return others.length === 0 && first !== undefined
    ? usersetOfWay(first)
    : { union: { child: ways.map(usersetOfWay) } };
}

function usersetOfWay(way: Way): OpenFgaUserset {
  if (typeof way === 'string') {
    return { computedUserset: { relation: relationNameOf(way) } };
  }

  return {
    tupleToUserset: {
      tupleset: { relation: way.via },
      computedUserset: { relation: relationNameOf(way.holds) },
    },
  };
}
