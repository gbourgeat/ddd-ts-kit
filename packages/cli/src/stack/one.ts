import { toName } from '../naming/index.js';

/** One boolean per option, true for the chosen one: what a template tests with `{{#if stack.option}}`. */
export function one<T extends string>(value: T, options: readonly T[]): Record<string, boolean> {
  return Object.fromEntries(options.map((option) => [toName(option).camel, option === value]));
}
