import type { Appended } from '../event-sourcing/appended';
import type { EventToAppend } from '../event-sourcing/event-to-append';
import type { StoredEvent } from '../event-sourcing/stored-event';

/**
 * Where event-sourced aggregates keep their streams: one stream per aggregate, read in order,
 * and the whole store read in the order the appends committed, for the subscriptions. Stored
 * events are never changed. Only repository adapters and subscriptions use it: the domain and the
 * use cases never read a stream.
 */
export abstract class EventStore {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.EventStore' });
  }

  /**
   * Appends the events to the stream if it still has `expectedVersion` events (0: the stream does
   * not exist yet), and refuses with a ConcurrencyError otherwise: somebody else appended since it
   * was read. Joins the transaction of the current unit of work when the store is transactional.
   */
  abstract append(stream: string, expectedVersion: number, events: readonly EventToAppend[]): Promise<Appended>;

  /** The events of the stream after version `after` (default 0: all of them), in their order. */
  abstract readStream(stream: string, after?: number): Promise<readonly StoredEvent[]>;

  /** Up to `limit` events of the whole store after position `after`, in the order of their positions. */
  abstract readAll(after: number, limit: number): Promise<readonly StoredEvent[]>;

  /** The position of the last event stored, 0 when there is none. */
  abstract head(): Promise<number>;
}
