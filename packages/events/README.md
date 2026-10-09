# @ddd-ts-kit/events

Integration events between bounded contexts, independent of any broker: typed declarations,
a registry, validated publication and consumption, a transactional outbox, and the AsyncAPI
document and event catalog generated from the declarations.

```
npm i @ddd-ts-kit/events @ddd-ts-kit/validation zod
```

## Declare

One declaration per event and version, in the producer's `published-language/`. It gives the
payload type, validates what is published and consumed, and feeds the generators.

```ts
// contexts/ordering/published-language/order-placed.event.ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';

export const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed', // <context>.<aggregate>.<fact>, kebab-case segments
  version: 1,
  description: 'An order was placed by a customer.',
  payload: zodSchema(
    z.object({
      orderId: z.string().describe('Identifier of the order.'),
      total: z.object({ amount: z.number().int(), currency: z.enum(['EUR', 'USD']) }),
      lines: z.array(z.object({ sku: z.string(), quantity: z.number().int().positive() })),
    }),
  ),
});

export type OrderPlaced = PayloadOf<typeof orderPlaced>;
```

A breaking change is a new declaration with `version: 2`; mark the old one `deprecated: true`
and keep publishing both until the consumers have moved.

## Publish through the outbox

The handler publishes to an `IntegrationEventPublisher` and knows nothing else. With a
database, that publisher is the `OutboxPublisher`: it only stores, inside the transaction of
the command, so the event commits or rolls back with the business write.

```ts
// contexts/ordering/application/commands/place-order/place-order.handler.ts
const event = orderPlaced.create(
  { orderId: order.id, total: order.total, lines: order.lines },
  { id: this.ids.next(), occurredAt: this.clock.now(), correlationId: command.correlationId },
); // throws InvalidEventPayloadError: publishing an invalid event is a bug
await this.publisher.publish([event]);
```

```ts
// main.ts
import { createEventRegistry, OutboxPublisher, OutboxRelay, validatingPublisher } from '@ddd-ts-kit/events';

const registry = createEventRegistry([orderPlaced, invoiceIssued]);
const store = new DrizzleOutboxStore(unitOfWork); // or InMemoryOutboxStore in a single process
const publisher = validatingPublisher(new OutboxPublisher(store), registry, { unknown: 'reject' });

const relay = new OutboxRelay({
  store,
  publisher: broker, // the real provider: any IntegrationEventPublisher
  clock,
  maxAttempts: 8,
  onFailure: (failure) => logger.warn(failure), // codes only, never an error message
});
relay.start({ intervalMs: 500 });
process.on('SIGTERM', () => void relay.stop()); // waits for the tick in progress
```

`relay.tick()` claims a batch, publishes each event, marks it published, or schedules a retry
with an exponential backoff; after `maxAttempts` the record is `dead` until
`store.retryDead(ids, now)`. `store.stats()` gives `{ pending, failed, dead }` for a health
check, `store.purgePublished(before)` keeps the table small.

Delivery is at least once. **Ordering is not guaranteed, not even per aggregate**: a failed
event is retried while its successors go out, and several relays may run side by side. When
order matters, carry a sequence or a version in the payload.

An `OutboxStore` leases what it hands out: `claimBatch` hides the claimed records for the
lease of the store, so a relay that dies lets them come back. Adapters are held to
`outboxStoreContract` of `@ddd-ts-kit/testing/contracts`.

## Consume idempotently

```ts
// contexts/billing/application/integration/consumers/order-placed.consumer.ts
import { on, subscribeAll } from '@ddd-ts-kit/events';

export const billingSubscriptions = (commandBus: CommandBus, processed: ProcessedEventStore) => [
  on(
    orderPlaced,
    async (event) => {
      await commandBus.execute(new IssueInvoice(event.payload.orderId, event.payload.total));
    },
    { consumer: 'billing', processed },
  ),
];

// billing.module.ts
const subscription = subscribeAll(subscriber, billingSubscriptions(commandBus, processed));
```

The handler receives a typed, validated event. An event of another version of the same type
is skipped (subscribe to it with its own declaration); an invalid payload throws, so the
provider retries or dead-letters; with `processed`, a redelivery is handled once per consumer.

## Generate the AsyncAPI document and the catalog

```ts
// scripts/generate-contracts.ts
import { generateEventCatalog } from '@ddd-ts-kit/events';
import { checkAsyncApiDrift, generateAsyncApi, stringifyAsyncApi } from '@ddd-ts-kit/events/asyncapi';

const document = generateAsyncApi({
  info: { title: 'Shop events', version: '1.4.0' },
  registry,
  servers: { production: { host: 'broker.example.com:5671', protocol: 'amqps' } },
});
await writeFile('asyncapi.json', stringifyAsyncApi(document));
await writeFile(
  'docs/EVENTS.md',
  generateEventCatalog(registry, { consumers: { 'ordering.order.placed': ['billing', 'shipping'] } }),
);

// In CI: fail when the committed file is stale.
if (checkAsyncApiDrift(document, await readFile('asyncapi.json', 'utf8')).drift) process.exit(1);
```

The AsyncAPI 3.0.0 document has one channel per event type (its address is the type), one
message per version whose payload is the envelope (`id`, `type`, `version`, `occurredAt`,
`payload`, `traceparent`, `correlationId`), and one `send` operation per channel. The catalog
is Markdown: one section per producer, a table of versions per event, and the payload fields
flattened (`customer.email`, `lines[].sku`). Both outputs depend only on the declarations,
never on their registration order, so they can be committed and diffed.
