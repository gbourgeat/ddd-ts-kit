import type { PolicyInput } from './policy-input.js';

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
