import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import type { CheckpointStore } from '../../application/ports/checkpoint-store';
import type { EventStore } from '../../application/ports/event-store';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import { inTenantOfEvent } from './in-tenant-of-event';

export interface CatchUpSubscriptionParts {
  /** The subscriber, `<context>.<name>`: the name of the projection it feeds, and of its checkpoint. */
  readonly name: string;
  readonly store: EventStore;
  readonly checkpoints: CheckpointStore;
  /** The unit of work of the database the subscriber writes to: the checkpoint commits with what was applied. */
  readonly unitOfWork: UnitOfWork;
  /** Applies one event of the store; passes over the events it does not apply. */
  apply(event: StoredEvent): Promise<void>;
  /**
   * With a scope, each event is applied in the tenant its stream recorded (`StoredEvent.tenantId`),
   * so the projection reads and writes that tenant only; the event store must be given the same scope.
   */
  readonly scope?: ExecutionScope;
  /** Events applied per unit of work. Default 100. */
  readonly batchSize?: number;
}

/**
 * Feeds a subscriber from the event store, in the order of the store, from where its checkpoint
 * stands. Each batch is applied and the checkpoint moved in one unit of work: a failure applies
 * none of the batch, which is read again at the next poll. Two runs of the same subscriber
 * never both move the checkpoint: the second one is refused (`ConcurrencyError`) and rolled
 * back. A subscriber started on a store that already holds events catches up from position
 * zero, which is also how a new projection is filled.
 */
export class CatchUpSubscription {
  constructor(private readonly parts: CatchUpSubscriptionParts) {}

  /** Applies the next batch, if any. Answers how many events were read. */
  poll(): Promise<number> {
    const { name, store, checkpoints, unitOfWork, batchSize = 100 } = this.parts;

    return unitOfWork.run(async () => {
      const from = await checkpoints.position(name);
      const events = await store.readAll(from, batchSize);
      const last = events.at(-1);

      for (const event of events) {
        await inTenantOfEvent(this.parts.scope, name, event, () => this.parts.apply(event));
      }

      if (last !== undefined) {
        await checkpoints.advance(name, from, last.position);
      }

      return events.length;
    });
  }

  /** Polls until the subscriber has applied the whole store. Answers how many events were read. */
  async catchUp(): Promise<number> {
    let read = 0;

    for (let batch = await this.poll(); batch > 0; batch = await this.poll()) {
      read += batch;
    }

    return read;
  }
}
