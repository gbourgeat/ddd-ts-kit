import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { InvoicingFailed } from './invoicing-failed';

/** A handler that records what it receives and fails its first `failures` deliveries. */
export const recorder = (failures = 0) => {
  const received: IntegrationEvent[] = [];
  let remaining = failures;

  const handler = async (event: IntegrationEvent): Promise<void> => {
    received.push(event);

    if (remaining > 0) {
      remaining -= 1;
      throw new InvoicingFailed();
    }
  };

  return { received, handler, ids: () => received.map((event) => event.id) };
};
