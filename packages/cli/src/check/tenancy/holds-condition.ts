import { argumentsOfCall } from './arguments-of-call';
import { bareExpression } from './bare-expression';
import { choiceBranches } from './choice-branches';
import { declarationBefore } from './declaration-before';

const LOCAL = /^[A-Za-z_$][\w$]*$/;

/** How a tenant condition is looked for: the source, where the statement is, and the helper that writes it. */
export interface ConditionReading {
  readonly code: string;
  readonly at: number;
  readonly helper: RegExp;
}

/**
 * Whether an expression holds the condition on every path through it: the helper called, a choice
 * that holds it on both branches, a local declared with what holds it; anything else is what
 * `holds` says, which is what an ORM makes of a conjunction. Each local followed is declared
 * before the last, so the reading ends.
 */
export function holdsCondition(
  text: string,
  reading: ConditionReading,
  holds: (bare: string, reading: ConditionReading) => boolean,
): boolean {
  const bare = bareExpression(text);
  const branches = choiceBranches(bare);

  if (branches !== undefined) {
    return branches.every((branch) => holdsCondition(branch, reading, holds));
  }

  if (argumentsOfCall(bare, new RegExp(`^(?:${reading.helper.source})`)) !== undefined) {
    return true;
  }

  const declaration = LOCAL.test(bare) ? declarationBefore(reading.code, bare, reading.at) : undefined;

  return declaration === undefined
    ? holds(bare, reading)
    : holdsCondition(declaration.text, { ...reading, at: declaration.at }, holds);
}
