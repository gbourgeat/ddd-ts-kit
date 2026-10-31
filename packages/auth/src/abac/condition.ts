import type { PolicyInput } from './policy-input';

export type Condition = (input: PolicyInput) => boolean;

export function anyOf(...conditions: readonly Condition[]): Condition {
  return (input) => conditions.some((condition) => condition(input));
}

export function allOf(...conditions: readonly Condition[]): Condition {
  return (input) => conditions.every((condition) => condition(input));
}

export function not(condition: Condition): Condition {
  return (input) => !condition(input);
}

/**
 * Holds when the resource is known by every attribute named: the port answered them. A projection
 * that does not hold an element yet answers none, so a rule written with it refuses that element
 * (`forbid(..., not(known('amount')))`) instead of reading attributes that are not there.
 */
export function known(...names: readonly string[]): Condition {
  return ({ attributes }) => names.every((name) => attributes[name] !== undefined);
}
