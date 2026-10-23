import { storedDataOf } from '../../application/event-sourcing/stored-data-of';
import { StoredEventData } from '../../application/event-sourcing/stored-event-data';
import type { EventToAppend } from '../../application/event-sourcing/event-to-append';
import { appendChanges } from '../../application/persistence/append-changes';
import type { EventStore } from '../../application/ports/event-store';
import type { DomainEvent } from '../../domain/domain-event';
import type { AggregateHistory } from '../../domain/event-sourcing/aggregate-history';
import type { AggregateSnapshot } from '../../domain/event-sourcing/aggregate-snapshot';
import type { EventSourcedAggregate } from '../../domain/event-sourcing/event-sourced-aggregate';
import type { EventSerializer } from './event-serializer';
import type { SnapshotPolicy } from './snapshot-policy';

export interface EventSourcedRepositoryParts<A extends EventSourcedAggregate<E, S>, E extends DomainEvent, S> {
  readonly store: EventStore;
  readonly serializer: EventSerializer<E>;
  /** `<context>.<aggregate>`: the stream of an aggregate is `<category>-<id>`. */
  readonly category: string;
  /** The static `rehydrate` of the aggregate: `(id, history) => AttendanceRecord.rehydrate(id, history)`. */
  rehydrate(id: string, history: AggregateHistory<E, S>): A;
  readonly snapshots?: SnapshotPolicy<A, S>;
}

/**
 * What the repository adapter of an event-sourced aggregate delegates to: `findById` replays the
 * stream, from the last snapshot when the aggregate takes them; `save` appends what the aggregate
 * recorded, at the version it was loaded at, in the transaction of the unit of work, and takes a
 * snapshot when one is due. The events then leave with the save like any other (`dispatchingOnSave`).
 */
export class EventSourcedRepository<A extends EventSourcedAggregate<E, S>, E extends DomainEvent, S = never> {
  constructor(private readonly parts: EventSourcedRepositoryParts<A, E, S>) {}

  static streamOf(category: string, id: string): string {
    return `${category}-${id}`;
  }

  async findById(id: string): Promise<A | undefined> {
    const stream = EventSourcedRepository.streamOf(this.parts.category, id);
    const snapshot = await this.snapshotOf(stream);
    const stored = await this.parts.store.readStream(stream, snapshot?.version ?? 0);

    if (snapshot === undefined && stored.length === 0) {
      return undefined;
    }

    const events: E[] = [];

    for (const event of stored) {
      events.push(await this.parts.serializer.deserialize(event));
    }

    return this.parts.rehydrate(id, snapshot === undefined ? { events } : { snapshot, events });
  }

  async save(aggregate: A): Promise<void> {
    const before = aggregate.version;
    const stream = EventSourcedRepository.streamOf(this.parts.category, aggregate.id);

    await appendChanges(aggregate, async ({ expected, events }) => {
      await this.parts.store.append(stream, expected, await this.serialized(events));
    });

    await this.snapshotIfDue(aggregate, stream, before);
  }

  private async serialized(events: readonly DomainEvent[]): Promise<EventToAppend[]> {
    const serialized: EventToAppend[] = [];

    for (const event of events) {
      serialized.push(await this.parts.serializer.serialize(event));
    }

    return serialized;
  }

  private async snapshotIfDue(aggregate: A, stream: string, before: number): Promise<void> {
    const policy = this.parts.snapshots;

    if (policy === undefined || Math.floor(aggregate.version / policy.every) === Math.floor(before / policy.every)) {
      return;
    }

    await policy.store.save({
      stream,
      version: aggregate.version,
      schemaVersion: policy.version,
      data: await this.parts.serializer.seal(storedDataOf(policy.encode(aggregate))),
    });
  }

  private async snapshotOf(stream: string): Promise<AggregateSnapshot<S> | undefined> {
    const policy = this.parts.snapshots;
    const found = await policy?.store.find(stream);

    if (policy === undefined || found === undefined || found.schemaVersion !== policy.version) {
      return undefined;
    }

    const data = await this.parts.serializer.open(found.data);

    return { version: found.version, state: policy.decode(new StoredEventData(data, `the snapshot of ${stream}`)) };
  }
}
