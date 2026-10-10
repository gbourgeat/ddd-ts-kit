import type { IntegrationEvent, IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import { failureCode } from '../errors/failure-code.js';

/** Runs every handler, so one that fails does not starve the others; gives the first code. */
export async function failureOf(
  handlers: ReadonlySet<IntegrationEventCallback>,
  event: IntegrationEvent,
): Promise<string | undefined> {
  let code: string | undefined;

  for (const handler of [...handlers]) {
    try {
      await handler(event);
    } catch (error) {
      code ??= failureCode(error);
    }
  }

  return code;
}
