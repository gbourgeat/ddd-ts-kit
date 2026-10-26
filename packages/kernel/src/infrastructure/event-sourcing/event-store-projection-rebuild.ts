import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import type { EventStore } from '../../application/ports/event-store';
import type { ReadModelStore } from '../../application/ports/read-model-store';
import type { ReadModelTable } from '../../application/ports/read-model-table';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import { inTenantOfEvent } from './in-tenant-of-event';
import { ShadowReadModelStore } from '../read-model/shadow-read-model-store';

export interface EventStoreProjectionRebuildParts<Row> {
  readonly table: ReadModelTable<Row>;
  readonly store: EventStore;
  /** The unit of work of the table's database: the end of the replay and the swap are one transaction. */
  readonly unitOfWork: UnitOfWork;
  /** How the projection applies an event to the store it is given: the same projection, built over the copy. */
  applierOn(copy: ReadModelStore<Row>): (event: StoredEvent) => Promise<void>;
  /** The subscriber being rebuilt, `<context>.<name>`: the name the events are applied under. Default `rebuild`. */
  readonly name?: string;
  /** With a scope, each event is applied in the tenant its stream recorded, as the subscription does. */
  readonly scope?: ExecutionScope;
  /** Events read per round. Default 500. */
  readonly batchSize?: number;
}

/** What a rebuild from the event store did. */
export interface EventStoreRebuildReport {
  /** Events read from the store, from position zero to its head at the swap. */
  readonly replayed: number;
}

/**
 * Rebuilds a read model fed by the event store from position zero, without stopping its catch-up
 * subscription. An empty copy of the table is filled by replaying the whole store through the
 * projection; then, in one transaction, the writers are held, the events appended meanwhile are
 * replayed, and the copy takes the place of the table. The subscription goes on from its
 * checkpoint: what it applies again is stale against the stamps of the copy.
 */
export class EventStoreProjectionRebuild<Row> {
  constructor(private readonly parts: EventStoreProjectionRebuildParts<Row>) {}

  async run(): Promise<EventStoreRebuildReport> {
    const { table, unitOfWork } = this.parts;

    await table.abandonRebuild();
    await table.beginRebuild();

    try {
      const apply = this.parts.applierOn(new ShadowReadModelStore(table.shadow()));
      const copied = await this.replay(apply, 0);

      const replayed = await unitOfWork.run(async () => {
        await table.holdWriters();

        const caughtUp = await this.replay(apply, copied.position);

        await table.promote();

        return copied.read + caughtUp.read;
      });

      return { replayed };
    } catch (error) {
      await table.abandonRebuild();

      throw error;
    }
  }

  private async replay(
    apply: (event: StoredEvent) => Promise<void>,
    from: number,
  ): Promise<{ readonly position: number; readonly read: number }> {
    const { store, batchSize = 500, scope, name = 'rebuild' } = this.parts;
    let position = from;
    let read = 0;

    for (
      let events = await store.readAll(position, batchSize);
      events.length > 0;
      events = await store.readAll(position, batchSize)
    ) {
      for (const event of events) {
        await inTenantOfEvent(scope, name, event, () => apply(event));
        position = event.position;
      }

      read += events.length;
    }

    return { position, read };
  }
}
