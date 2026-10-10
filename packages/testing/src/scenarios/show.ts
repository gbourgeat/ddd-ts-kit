import { inspect } from 'node:util';

/** A value on one line, keys sorted, as the failure messages of a scenario quote it. */
export function show(value: unknown): string {
  return inspect(value, { depth: 4, breakLength: Infinity, sorted: true });
}
