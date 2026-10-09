# @ddd-ts-kit/drizzle

Drizzle adapters of the kernel and events ports on PostgreSQL: a unit of work that
repositories never see, the transactional outbox store, the processed-event store, and one
database schema per bounded context. Drizzle is the default persistence of the kit, not a
requirement: everything here implements ports, and another ORM is another adapter passing the
same contract suites.

```
npm i @ddd-ts-kit/drizzle drizzle-orm
```

Works with every drizzle PostgreSQL driver (node-postgres, postgres-js, PGlite, Neon): the
functions are generic over the database type, so `executor()` is typed exactly like your `db`.

## Schema

The tables are plain drizzle definitions: export them from the schema files drizzle-kit reads
and they are created by your own migrations.

```ts
// platform/database/schema.ts
import { contextSchema, outboxTable, processedEventsTable } from '@ddd-ts-kit/drizzle/postgres';

export const outbox = outboxTable('messaging'); // messaging.outbox; no argument: public.outbox
export const processedEvents = processedEventsTable('messaging');

// contexts/order-management/infrastructure/persistence/schema.ts
export const orderManagement = contextSchema('order-management'); // schema order_management
export const orders = orderManagement.table('orders', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  version: integer('version').notNull(),
});
```

`outbox` is indexed for the relay (pending records by next attempt, partial index);
`processed_events` has `(consumer, event_id)` as its primary key.

## Composition root

```ts
// main.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { InMemoryCommandBus, SystemClock, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import {
  createDrizzleUnitOfWork,
  DrizzleOutboxStore,
  DrizzleProcessedEventStore,
} from '@ddd-ts-kit/drizzle/postgres';

const db = drizzle(process.env.DATABASE_URL);
const unitOfWork = createDrizzleUnitOfWork(db);

// Every command runs in one transaction; handlers do not know it.
const commandBus = new InMemoryCommandBus().use(unitOfWorkMiddleware(unitOfWork));

const outboxStore = new DrizzleOutboxStore(unitOfWork, { table: outbox });
const publisher = new OutboxPublisher(outboxStore); // what handlers publish to
const processed = new DrizzleProcessedEventStore(unitOfWork, { table: processedEvents });
const orders = new DrizzleOrderRepository(unitOfWork);

const relay = new OutboxRelay({ store: outboxStore, publisher: broker, clock: new SystemClock() });
relay.start({ intervalMs: 500 });
```

`unitOfWork.run(work)` opens `db.transaction` and keeps the transaction in an
`AsyncLocalStorage`; a nested `run` joins the outer transaction. Because `append` uses the
current transaction, an event published by a handler that then fails is rolled back with the
business write: that is the whole point of the outbox.

## Repository

A repository receives the context, never a transaction. `executor()` is the transaction of the
unit of work when there is one and `db` otherwise.

```ts
// contexts/order-management/infrastructure/persistence/drizzle-order.repository.ts
import { and, eq } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { optimisticUpdate, type DrizzleContext } from '@ddd-ts-kit/drizzle/postgres';

export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly context: DrizzleContext<NodePgQueryResultHKT>) {}

  async findById(id: string): Promise<Order | undefined> {
    const [row] = await this.context.executor().select().from(orders).where(eq(orders.id, id));
    return row === undefined ? undefined : OrderMapper.toDomain(row); // sets order.version
  }

  async save(order: Order): Promise<void> {
    const db = this.context.executor();
    await optimisticUpdate(order, async ({ expected, next }) => {
      const row = { ...OrderMapper.toRow(order), version: next };
      const written =
        expected === 0
          ? await db.insert(orders).values(row).onConflictDoNothing().returning({ id: orders.id })
          : await db
              .update(orders)
              .set(row)
              .where(and(eq(orders.id, order.id), eq(orders.version, expected)))
              .returning({ id: orders.id });
      return written.length;
    });
  }
}
```

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `order.version` on otherwise. If your database was created
with a relational schema (`drizzle(url, { schema })`), type the context as
`DrizzleContext<NodePgQueryResultHKT, typeof schema>` to keep `executor().query`.

## Outbox and idempotency

- `DrizzleOutboxStore.claimBatch` selects the due rows `FOR UPDATE SKIP LOCKED` and leases
  them in the same short transaction by pushing `next_attempt_at` forward (`leaseMs`, default
  30 s), so several relays share the work without waiting for each other, and the records of a
  relay that died come back when the lease expires. Delivery is at least once, unordered.
- `DrizzleProcessedEventStore.markProcessed` is an `INSERT ... ON CONFLICT DO NOTHING`. Run
  the consumer inside the unit of work: the mark then commits with the effects of the handler,
  and disappears with them if it fails.

## Testing an adapter

The stores of this package pass `outboxStoreContract` and `processedEventStoreContract` of
`@ddd-ts-kit/testing/contracts` on PGlite (PostgreSQL in process, no container). Hold your
repositories to `repositoryContract` the same way, next to their in-memory fake.
