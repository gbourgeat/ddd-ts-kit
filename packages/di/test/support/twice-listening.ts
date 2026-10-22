import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { defineContextModule, type ContextModule } from '../../src';
import { OrderPlaced, type OrderPlacedPayload } from './ordering/published-language/order-placed';

/**
 * A context that listens to placed orders twice: through a class that declares itself and
 * through a statement of its module. Each writes `<context> <style> <event id>` to the journal.
 */
export function twiceListening(name: string, journal: string[]): ContextModule {
  class OnOrderPlaced {
    async handle(event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {
      journal.push(`${name} declared ${event.id}`);
    }
  }

  IntegrationEventHandler(OrderPlaced, { consumer: `${name}.declared` })(OnOrderPlaced);

  return defineContextModule({
    name,
    register(builder) {
      builder.include([OnOrderPlaced]);

      builder
        .on(OrderPlaced, { consumer: `${name}.written` })
        .handledByFactory(() => ({ handle: async (event) => void journal.push(`${name} written ${event.id}`) }));
    },
  });
}
