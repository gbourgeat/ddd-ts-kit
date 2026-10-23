import type { BindingDescription } from './binding-description';
import type { ExchangeDescription } from './exchange-description';
import type { QueueDescription } from './queue-description';

/** Everything the bus declares on the broker, as data: for documentation and reviews. */
export interface RabbitMqTopology {
  readonly exchanges: readonly ExchangeDescription[];
  readonly queues: readonly QueueDescription[];
  readonly bindings: readonly BindingDescription[];
}
