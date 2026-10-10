import type { EventContract, IntegrationEventHandler, Token } from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerOptions } from '../consumer/consumer-options.js';
import { receive } from '../consumer/receive.js';
import type { Declarer } from '../wiring/declarer.js';
import type { EventConsumption } from '../wiring/event-consumption.js';

interface Subscribing<Payload> {
  readonly contract: EventContract<Payload>;
  readonly options: ConsumerOptions;
  readonly handler: Token<IntegrationEventHandler<Payload>>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}

/** The subscription of one consumer, whether a module wrote it or a class declared it. */
export function consumptionOf<Payload>(subscribing: Subscribing<Payload>): EventConsumption {
  const { contract, options, handler, module, declaredBy } = subscribing;

  return {
    type: contract.type,
    version: contract.version,
    consumer: options.consumer,
    handler,
    module,
    ...(declaredBy === undefined ? {} : { declaredBy }),
    subscribe: (resolve, runtime) =>
      receive({ contract, options, runtime, handle: (event) => resolve(handler).handle(event) }),
  };
}
