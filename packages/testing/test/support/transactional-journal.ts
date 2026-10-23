import { AsyncLocalStorage } from 'node:async_hooks';
import {
  ConcurrencyError,
  withinUnitOfWork,
  type Appended,
  type EventStore,
  type EventToAppend,
  type IntegrationEvent,
  type StoredEvent,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { EventStoreUnderContract } from '../../src/contracts';

interface Written {
  readonly events: StoredEvent[];
  readonly published: IntegrationEvent[];
}

/** An event store and an outbox in memory with real transactions: what a unit of work writes is forgotten when it fails. */
export class TransactionalJournal implements EventStoreUnderContract {
  readonly unitOfWork: UnitOfWork = { run: (work) => withinUnitOfWork(work, (scoped) => this.atomically(scoped)) };

  private readonly committed: Written = { events: [], published: [] };

  private readonly current = new AsyncLocalStorage<Written>();

  readonly store: EventStore = {
    append: async (stream, expected, events) => this.append(stream, expected, events),
    readStream: async (stream, after = 0) =>
      this.visible().filter((event) => event.stream === stream && event.version > after),
    readAll: async (after, limit) => this.visible().slice(after, after + limit),
    head: async () => this.visible().length,
  };

  readonly outbox: EventStoreUnderContract['outbox'] = {
    append: async (events) => void this.target().published.push(...events),
    claimBatch: async () => this.committed.published.map((event) => ({ event, status: 'pending', attempts: 1 })),
    stats: async () => ({ pending: this.committed.published.length, failed: 0, dead: 0 }),
  };

  private append(stream: string, expected: number, events: readonly EventToAppend[]): Appended {
    const version = this.visible().filter((event) => event.stream === stream).length;

    if (version !== expected) {
      throw new ConcurrencyError(stream);
    }

    const position = this.visible().length;

    this.target().events.push(
      ...events.map((event, index) => ({
        ...event,
        metadata: event.metadata ?? {},
        stream,
        version: version + index + 1,
        position: position + index + 1,
      })),
    );

    return { version: version + events.length, position: position + events.length };
  }

  private visible(): StoredEvent[] {
    return [...this.committed.events, ...(this.current.getStore()?.events ?? [])];
  }

  private target(): Written {
    return this.current.getStore() ?? this.committed;
  }

  private async atomically<T>(work: () => Promise<T>): Promise<T> {
    if (this.current.getStore() !== undefined) {
      return work();
    }

    const written: Written = { events: [], published: [] };
    const result = await this.current.run(written, work);

    this.committed.events.push(...written.events);
    this.committed.published.push(...written.published);

    return result;
  }
}
