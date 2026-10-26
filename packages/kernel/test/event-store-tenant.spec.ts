import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CatchUpSubscription,
  EventStoreProjectionRebuild,
  EventStreamTenantError,
  FixedExecutionScope,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemoryReadModelTable,
  InMemoryUnitOfWork,
  executionContext,
  eventStoreTablesSql,
  eventStoreTenantColumnSql,
  postgresEventSourcing,
  systemActor,
  type EventToAppend,
  type SqlRun,
  type StoredEvent,
} from '../src';

const inTenant = (tenantId: string) =>
  executionContext({ correlationId: 'req', actor: systemActor('test'), origin: 'http', tenantId });

const event = (id: string): EventToAppend => ({
  id,
  type: 'shipping.parcel.weighed',
  schemaVersion: 1,
  data: {},
  occurredAt: new Date('2026-10-18T09:30:00.000Z'),
});

describe('a projection fed by an event store that keeps the tenant', () => {
  async function seeded() {
    const scope = new FixedExecutionScope();
    const store = new InMemoryEventStore(scope);

    scope.enter(inTenant('acme'));
    await store.append('parcel-1', 0, [event('a1')]);
    scope.enter(inTenant('globex'));
    await store.append('parcel-2', 0, [event('b1')]);
    scope.enter(executionContext({ correlationId: 'poll', actor: systemActor('poller'), origin: 'schedule' }));

    return { scope, store };
  }

  it('applies each event in the tenant of its stream, as a consumer of the outbox does', async () => {
    const { scope, store } = await seeded();
    const seen: unknown[] = [];

    const subscription = new CatchUpSubscription({
      name: 'shipping.weights',
      store,
      checkpoints: new InMemoryCheckpointStore(),
      unitOfWork: new InMemoryUnitOfWork(),
      scope,
      apply: async (stored: StoredEvent) => {
        const context = scope.require();

        seen.push([stored.id, context.tenantId, context.origin, context.causationId]);
      },
    });

    await subscription.catchUp();

    expect(seen).toEqual([
      ['a1', 'acme', 'event', 'a1'],
      ['b1', 'globex', 'event', 'b1'],
    ]);

    expect(scope.require().origin).toBe('schedule');
  });

  it('applies an event of a stream without tenant as it comes', async () => {
    const scope = new FixedExecutionScope();
    const store = new InMemoryEventStore();
    const seen: unknown[] = [];

    await store.append('parcel-1', 0, [event('a1')]);

    await new CatchUpSubscription({
      name: 'shipping.weights',
      store,
      checkpoints: new InMemoryCheckpointStore(),
      unitOfWork: new InMemoryUnitOfWork(),
      scope,
      apply: async () => {
        seen.push(scope.current());
      },
    }).catchUp();

    expect(seen).toEqual([undefined]);
  });

  it('is rebuilt with each event applied in the tenant of its stream', async () => {
    const { scope, store } = await seeded();
    const seen: unknown[] = [];

    await new EventStoreProjectionRebuild({
      table: new InMemoryReadModelTable<{ readonly id: string }>(),
      store,
      unitOfWork: new InMemoryUnitOfWork(),
      scope,
      applierOn: () => async (stored) => {
        seen.push([stored.id, scope.require().tenantId]);
      },
    }).run();

    expect(seen).toEqual([
      ['a1', 'acme'],
      ['b1', 'globex'],
    ]);
  });
});

describe('the event store on PostgreSQL, tenant by tenant', () => {
  let database: PGlite;

  const run: SqlRun = async (statement, parameters) =>
    (await database.query<Readonly<Record<string, unknown>>>(statement, [...parameters])).rows;

  beforeAll(async () => {
    database = new PGlite();

    for (const statement of eventStoreTablesSql()) {
      await database.exec(statement);
    }
  });

  afterAll(async () => {
    await database.close();
  });

  it('refuses a stream stored before the column existed to every tenant, and gives it to the tenant of a migration', async () => {
    const scope = new FixedExecutionScope();
    const { events } = postgresEventSourcing(run, { scope });

    await database.exec('alter table stored_events drop column tenant_id');
    await events.head();
    await database.exec(eventStoreTenantColumnSql());
    await database.exec(eventStoreTenantColumnSql());

    await database.exec(
      `insert into stored_events (position, stream, version, event_id, type, schema_version, data, metadata, occurred_at)
       values (1, 'parcel-0', 1, 'old', 'shipping.parcel.weighed', 1, '{}', '{}', now())`,
    );

    scope.enter(inTenant('acme'));
    await expect(events.readStream('parcel-0')).rejects.toBeInstanceOf(EventStreamTenantError);

    await database.exec(`update stored_events set tenant_id = 'acme'`);

    expect((await events.readStream('parcel-0')).map(({ id, tenantId }) => [id, tenantId])).toEqual([['old', 'acme']]);
  });

  it('names the stream in its refusal, never the other tenant', () => {
    const refusal = new EventStreamTenantError('parcel-1');

    expect(refusal.message).toContain('parcel-1');
    expect(refusal.name).toBe('EventStreamTenantError');
  });
});
