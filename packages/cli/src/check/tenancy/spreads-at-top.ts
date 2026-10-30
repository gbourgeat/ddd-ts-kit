import { bareExpression } from './bare-expression';
import { enclosedBy } from './enclosed-by';
import { holdsCondition, type ConditionReading } from './holds-condition';
import { topLevelParts } from './top-level-parts';

const WHERE_KEY = /^where(?![\w$])\s*:?/;
const AND_KEY = /^AND\s*:/;
const SPREAD = '...';

/**
 * Whether the arguments of a Prisma or TypeORM statement hold the tenant for every row: the where
 * they give spreads the helper at its top, or is the helper. Its `OR` and `NOT` stay beside the
 * spread, and an `AND` holds it as a top does; under an `OR`, a `NOT` or a relation it holds for
 * that branch alone. A TypeORM where array is an `or` of its entries: each one spreads it.
 */
export function spreadsAtTop(argumentsText: string, reading: ConditionReading): boolean {
  return topLevelParts(argumentsText).some((argument) => holdsSpread(argument, reading));
}

function holdsSpread(text: string, reading: ConditionReading): boolean {
  return holdsCondition(text, reading, inLiteral);
}

function inLiteral(bare: string, reading: ConditionReading): boolean {
  const entries = enclosedBy(bare, '[');

  if (entries !== undefined) {
    const parts = topLevelParts(entries);

    return parts.length > 0 && parts.every((entry) => holdsSpread(entry, reading));
  }

  return inObject(topLevelParts(enclosedBy(bare, '{') ?? ''), reading);
}

/** The where of the arguments when they name one, and only it: a spread beside it reaches no where. */
function inObject(properties: readonly string[], reading: ConditionReading): boolean {
  const where = properties.find((property) => WHERE_KEY.test(property));

  return where === undefined
    ? properties.some((property) => inProperty(property, reading))
    : holdsSpread(where.replace(WHERE_KEY, '') || 'where', reading);
}

function inProperty(property: string, reading: ConditionReading): boolean {
  if (property.startsWith(SPREAD)) {
    return holdsSpread(property.slice(SPREAD.length), reading);
  }

  return AND_KEY.test(property) && inConjunction(property.replace(AND_KEY, ''), reading);
}

/** `AND: [a, b]` holds what one of its entries holds, as the top of a where does. */
function inConjunction(value: string, reading: ConditionReading): boolean {
  const bare = bareExpression(value);
  const entries = enclosedBy(bare, '[');

  return entries === undefined
    ? holdsSpread(bare, reading)
    : topLevelParts(entries).some((entry) => holdsSpread(entry, reading));
}
