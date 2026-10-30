import type { Appended } from '../../application/event-sourcing/appended';
import type { EventToAppend } from '../../application/event-sourcing/event-to-append';
import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import { assertStreamReach } from '../../application/event-sourcing/assert-stream-reach';
import type { EventStore } from '../../application/ports/event-store';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import { assertNamesTenant } from '../../application/tenancy/assert-names-tenant';
import { ConcurrencyError } from '../../domain/errors/concurrency-error';

/** Reference implementation, for tests and single-process apps. Not transactional: a failed unit of work keeps what it appended.
 *
 * Given the execution scope, it holds tenant data, as the SQL stores do: it records the tenant of the
 * work at the first append of a stream, refuses a read or an append of a stream of another tenant
 * (`EventStreamTenantError`) and work that names no tenant (`NoCurrentTenantError`).
 */
export class InMemoryEventStore implements EventStore {
  private readonly events: StoredEvent[] = [];

  constructor(private readonly scope?: ExecutionScope) {}

  async append(stream: string, expectedVersion: number, events: readonly EventToAppend[]): Promise<Appended> {
    const held = this.reached(stream, 'write');
    const version = held.length;

    if (version !== expectedVersion) {
      throw new ConcurrencyError(stream);
    }

    const tenantId = held[0]?.tenantId ?? this.scope?.current()?.tenantId;

    events.forEach((event, index) => {
      this.events.push(
        structuredClone({
          ...event,
          metadata: event.metadata ?? {},
          stream,
          ...(tenantId === undefined ? {} : { tenantId }),
          version: version + index + 1,
          position: this.events.length + 1,
        }),
      );
    });

    return { version: version + events.length, position: this.events.length };
  }

  async readStream(stream: string, after = 0): Promise<readonly StoredEvent[]> {
    return this.reached(stream, 'read')
      .filter((event) => event.version > after)
      .map(copy);
  }

  async readAll(after: number, limit: number): Promise<readonly StoredEvent[]> {
    return this.events.slice(Math.max(0, after), Math.max(0, after) + Math.max(0, limit)).map(copy);
  }

  async head(): Promise<number> {
    return this.events.length;
  }

  private reached(stream: string, access: 'read' | 'write'): StoredEvent[] {
    const held = this.events.filter((event) => event.stream === stream);

    if (this.scope === undefined) {
      return held;
    }

    const context = this.scope.current();

    assertNamesTenant(context, access);

    if (held.length > 0) {
      assertStreamReach(context, { stream, recorded: held[0]?.tenantId }, access);
    }

    return held;
  }
}

function copy(event: StoredEvent): StoredEvent {
  return structuredClone(event);
}
