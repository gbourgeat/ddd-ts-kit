import { describe, expect, it } from 'vitest';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler, declarationOf } from '@ddd-ts-kit/kernel/declarations';
import type { PayloadOf } from '../src/index.js';
import { orderPlacedV1 } from './support/events.js';

type OrderPlaced = PayloadOf<typeof orderPlacedV1>;

describe('an event definition, given to the integration event handler declaration of the kernel', () => {
  it('fits as it is: the handler is typed by its payload and keeps its type and version', () => {
    const totals: number[] = [];

    class TotalOnOrderPlaced {
      readonly handle = async (event: IntegrationEvent<OrderPlaced>): Promise<void> => {
        totals.push(event.payload.total);
      };
    }

    IntegrationEventHandler(orderPlacedV1, { consumer: 'reporting.total-on-order-placed' })(TotalOnOrderPlaced);

    expect(declarationOf(TotalOnOrderPlaced)).toMatchObject({
      role: 'integration-event-handler',
      event: { type: 'ordering.order.placed', version: 1 },
      consumer: 'reporting.total-on-order-placed',
    });
  });

  it('hands the definition back to whoever subscribes the handler', () => {
    class AuditOnOrderPlaced {
      readonly handle = async (_event: IntegrationEvent<OrderPlaced>): Promise<void> => {};
    }
    IntegrationEventHandler(orderPlacedV1, { consumer: 'reporting.audit-on-order-placed' })(AuditOnOrderPlaced);
    const declaration = declarationOf(AuditOnOrderPlaced);

    const contract =
      declaration?.role === 'integration-event-handler' ? declaration.pair((definition) => definition) : undefined;

    expect(contract).toBe(orderPlacedV1);
  });
});
