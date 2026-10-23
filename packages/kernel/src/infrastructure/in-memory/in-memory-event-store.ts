import type { Appended } from '../../application/event-sourcing/appended';
import type { EventToAppend } from '../../application/event-sourcing/event-to-append';
import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import type { EventStore } from '../../application/ports/event-store';
import { ConcurrencyError } from '../../domain/errors/concurrency-error';

/** Reference implementation, for tests and single-process apps. Not transactional: a failed unit of work keeps what it appended. */
export class InMemoryEventStore implements EventStore {
  private readonly events: StoredEvent[] = [];

  async append(stream: string, expectedVersion: number, events: readonly EventToAppend[]): Promise<Appended> {
    const version = this.versionOf(stream);

    if (version !== expectedVersion) {
      throw new ConcurrencyError(stream);
    }

    events.forEach((event, index) => {
      this.events.push(
        structuredClone({
          ...event,
          metadata: event.metadata ?? {},
          stream,
          version: version + index + 1,
          position: this.events.length + 1,
        }),
      );
    });

    return { version: version + events.length, position: this.events.length };
  }

  async readStream(stream: string, after = 0): Promise<readonly StoredEvent[]> {
    return this.events.filter((event) => event.stream === stream && event.version > after).map(copy);
  }

  async readAll(after: number, limit: number): Promise<readonly StoredEvent[]> {
    return this.events.slice(Math.max(0, after), Math.max(0, after) + Math.max(0, limit)).map(copy);
  }

  async head(): Promise<number> {
    return this.events.length;
  }

  private versionOf(stream: string): number {
    return this.events.filter((event) => event.stream === stream).length;
  }
}

function copy(event: StoredEvent): StoredEvent {
  return structuredClone(event);
}
