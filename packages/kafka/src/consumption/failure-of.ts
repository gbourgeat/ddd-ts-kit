import type { EventDelivery, IntegrationEvent, IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import { failureCode } from '../errors/failure-code';

/**
 * Runs every handler, so one that fails does not starve the others; gives the first code. Each
 * handler is told which delivery this is, for what observes it from outside.
 */
export async function failureOf(
  handlers: ReadonlySet<IntegrationEventCallback>,
  event: IntegrationEvent,
  delivery: EventDelivery,
): Promise<string | undefined> {
  let code: string | undefined;

  for (const handler of [...handlers]) {
    try {
      await handler(event, delivery);
    } catch (error) {
      code ??= failureCode(error);
    }
  }

  return code;
}
