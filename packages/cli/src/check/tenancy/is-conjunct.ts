import { argumentsOfCall } from './arguments-of-call';
import { holdsCondition, type ConditionReading } from './holds-condition';
import { topLevelParts } from './top-level-parts';

const AND = /and\s*\(/;

/**
 * Whether a Drizzle condition holds the tenant for every row: the helper is the condition, or a
 * direct argument of an `and`, at any depth of `and`. An `or` or a `not` beside it is fine; the
 * helper under one of them, or in a `sql` template, holds for one branch alone.
 */
export function isConjunct(text: string, reading: ConditionReading): boolean {
  return holdsCondition(text, reading, inConjunction);
}

function inConjunction(bare: string, reading: ConditionReading): boolean {
  const list = argumentsOfCall(bare, AND);

  return list !== undefined && topLevelParts(list).some((part) => isConjunct(part, reading));
}
