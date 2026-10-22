import type { PrismaJsonInput } from './prisma-json-input';

/**
 * A JSON `null` payload is left out and stored as SQL NULL: Prisma refuses a bare null in a
 * Json field and its sentinels live in the generated client.
 */
export function payloadField(payload: unknown): { payload?: PrismaJsonInput } {
  if (payload === null || payload === undefined) {
    return {};
  }

  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the payload of an integration event is JSON by contract and typed `unknown` by the kernel; checking it here would walk every payload a second time
  return { payload: payload as PrismaJsonInput };
}
