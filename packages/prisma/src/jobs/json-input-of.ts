import type { PrismaJsonInput } from '../outbox/prisma-json-input';

/**
 * A value as the SQL stores of the kit keep it, plain JSON (a `Date` becomes its ISO text, an
 * `undefined` field disappears), typed as a `Json` field takes it. Never null nor undefined.
 */
export function jsonInputOf(value: unknown): PrismaJsonInput {
  const json: unknown = JSON.parse(JSON.stringify(value));

  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- what JSON.parse returns is plain JSON, which its type does not say
  return json as PrismaJsonInput;
}
