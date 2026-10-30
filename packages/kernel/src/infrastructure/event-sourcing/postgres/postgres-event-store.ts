import { assertStreamReach } from '../../../application/event-sourcing/assert-stream-reach';
import type { Appended } from '../../../application/event-sourcing/appended';
import type { EventToAppend } from '../../../application/event-sourcing/event-to-append';
import type { StoredEvent } from '../../../application/event-sourcing/stored-event';
import type { EventStore } from '../../../application/ports/event-store';
import type { ExecutionScope } from '../../../application/ports/execution-scope';
import { assertNamesTenant } from '../../../application/tenancy/assert-names-tenant';
import { ConcurrencyError } from '../../../domain/errors/concurrency-error';
import type { SqlRun } from '../../read-model/sql-run';
import type { EventStoreTablesOptions } from './event-store-tables-options';
import { isAppendConflict } from './is-append-conflict';
import { qualifiedTable } from './qualified-table';
import { storedDataFrom } from './stored-data-from';

type Row = Readonly<Record<string, unknown>>;

const COLUMNS = 'position, stream, version, event_id, type, schema_version, data, metadata, occurred_at';

// The instant as UTC text: drivers disagree on the zone they read a timestamptz in.
const SELECTED = `position, stream, version, event_id, type, schema_version, data, metadata,
  to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as occurred_at`;

const TENANT_SELECTED = `${SELECTED}, tenant_id`;

/**
 * The event store on PostgreSQL, shared by the ORM adapters, which differ only in how they run a
 * statement. An append is one statement on the executor of the unit of work: it takes the head of
 * the store, a row locked until the transaction ends, only when the stream still has the expected
 * version, and inserts the events after it. Appends therefore commit in the order of their
 * positions, and a subscription that read up to a position never meets a smaller one later; the
 * price is that two appends never run side by side, whatever their streams. A conflict that slips
 * between the check and the insert hits the unique (stream, version) and is a ConcurrencyError too,
 * and so are a serialization failure (a unit of work at REPEATABLE READ or SERIALIZABLE) and a
 * deadlock with row locks the same transaction took in another order: the caller retries. When
 * PostgreSQL gives up the other statement of such a cycle, the unit of work rejects with a
 * `TransactionConflictError`, a `ConcurrencyError` too.
 *
 * Given an execution scope (`options.scope`), the store holds tenant data: work that names no tenant
 * is refused before any statement (`NoCurrentTenantError`), the first append of a stream records the
 * tenant of the work in `tenant_id`, and a read or an append of a stream of another tenant is refused
 * with an `EventStreamTenantError`. `readAll` and `head` stay open: a subscription reads the whole
 * store and applies each event in its tenant.
 */
export class PostgresEventStore implements EventStore {
  private readonly events: string;

  private readonly headRow: string;

  private readonly scope: ExecutionScope | undefined;

  constructor(
    private readonly run: SqlRun,
    options: EventStoreTablesOptions = {},
  ) {
    this.events = qualifiedTable(options.schema, 'events');
    this.headRow = qualifiedTable(options.schema, 'head');
    this.scope = options.scope;
  }

  async append(stream: string, expectedVersion: number, events: readonly EventToAppend[]): Promise<Appended> {
    if (events.length === 0) {
      return this.unchanged(stream, expectedVersion);
    }

    const tenantId = await this.tenantToWrite(stream);

    await this.run(`insert into ${this.headRow} (id, position) values (1, 0) on conflict (id) do nothing`, []);

    const inserted = await this.inserted(stream, expectedVersion, events, tenantId);

    if (inserted.length === 0) {
      throw new ConcurrencyError(stream);
    }

    return {
      version: Math.max(...inserted.map((row) => Number(row['version']))),
      position: Math.max(...inserted.map((row) => Number(row['position']))),
    };
  }

  async readStream(stream: string, after = 0): Promise<readonly StoredEvent[]> {
    this.assertTenantNamed('read');

    const rows = await this.run(
      `select ${this.selected()} from ${this.events} where stream = $1::text and version > $2::integer order by version`,
      [stream, after],
    );

    if (this.scope !== undefined) {
      // A read past the end of the stream gives no row, and the stream is no less the one of its tenant.
      this.assertReach(stream, rows[0] ?? (await this.firstRowOf(stream)), 'read');
    }

    return rows.map(storedEventOf);
  }

  async readAll(after: number, limit: number): Promise<readonly StoredEvent[]> {
    const rows = await this.run(
      `select ${this.selected()} from ${this.events} where position > $1::bigint order by position limit $2::integer`,
      [after, limit],
    );

    return rows.map(storedEventOf);
  }

  async head(): Promise<number> {
    const [row] = await this.run(`select position from ${this.headRow} where id = 1`, []);

    return Number(row?.['position'] ?? 0);
  }

  private selected(): string {
    return this.scope === undefined ? SELECTED : TENANT_SELECTED;
  }

  private assertTenantNamed(access: 'read' | 'write'): void {
    if (this.scope !== undefined) {
      assertNamesTenant(this.scope.current(), access);
    }
  }

  private assertReach(stream: string, first: Row | undefined, access: 'read' | 'write'): void {
    if (first !== undefined) {
      assertStreamReach(this.scope?.current(), { stream, recorded: tenantOf(first) }, access);
    }
  }

  private async firstRowOf(stream: string): Promise<Row | undefined> {
    const [first] = await this.run(`select tenant_id from ${this.events} where stream = $1::text limit 1`, [stream]);

    return first;
  }

  /** The tenant a new event of the stream carries: the one its stream recorded, or the one of the work for a new stream. */
  private async tenantToWrite(stream: string): Promise<string | null> {
    if (this.scope === undefined) {
      return null;
    }

    this.assertTenantNamed('write');

    const first = await this.firstRowOf(stream);

    this.assertReach(stream, first, 'write');

    return (first === undefined ? this.scope.current()?.tenantId : tenantOf(first)) ?? null;
  }

  private async inserted(
    stream: string,
    expected: number,
    events: readonly EventToAppend[],
    tenantId: string | null,
  ): Promise<readonly Row[]> {
    try {
      const parameters = [stream, expected, JSON.stringify(events.map(recordOf))];

      return await this.run(
        this.appendStatement(),
        this.scope === undefined ? parameters : [...parameters, tenantId ?? ''],
      );
    } catch (error) {
      if (isAppendConflict(error)) {
        throw new ConcurrencyError(stream);
      }

      throw error;
    }
  }

  private appendStatement(): string {
    const tenant = this.scope !== undefined;

    return `with input as (
  select $1::text as stream, $2::integer as expected, $3::jsonb as events
), held as (
  select coalesce(max(e.version), 0) as version from ${this.events} e, input where e.stream = input.stream
), moved as (
  update ${this.headRow} h set position = h.position + jsonb_array_length(input.events)
  from input, held
  where h.id = 1 and held.version = input.expected
  returning h.position - jsonb_array_length(input.events) as base
)
insert into ${this.events} (${COLUMNS}${tenant ? ', tenant_id' : ''})
select moved.base + e.n, input.stream, input.expected + e.n, e.id, e.type, e.schema_version, e.data, e.metadata, e.occurred_at${tenant ? ", nullif($4::text, '')" : ''}
from moved, input, jsonb_to_recordset(input.events)
  as e(n integer, id text, type text, schema_version integer, data jsonb, metadata jsonb, occurred_at timestamptz)
order by e.n
returning position, version`;
  }

  private async unchanged(stream: string, expected: number): Promise<Appended> {
    await this.tenantToWrite(stream);

    const [row] = await this.run(
      `select coalesce(max(version), 0) as version from ${this.events} where stream = $1::text`,
      [stream],
    );

    if (Number(row?.['version'] ?? 0) !== expected) {
      throw new ConcurrencyError(stream);
    }

    return { version: expected, position: await this.head() };
  }
}

function recordOf(event: EventToAppend, index: number): Readonly<Record<string, unknown>> {
  return {
    n: index + 1,
    id: event.id,
    type: event.type,
    schema_version: event.schemaVersion,
    data: event.data,
    metadata: event.metadata ?? {},
    occurred_at: event.occurredAt.toISOString(),
  };
}

function tenantOf(row: Row): string | undefined {
  const tenantId = row['tenant_id'];

  return typeof tenantId === 'string' ? tenantId : undefined;
}

function storedEventOf(row: Row): StoredEvent {
  const id = String(row['event_id']);
  const tenantId = tenantOf(row);

  return {
    id,
    stream: String(row['stream']),
    version: Number(row['version']),
    position: Number(row['position']),
    type: String(row['type']),
    schemaVersion: Number(row['schema_version']),
    data: storedDataFrom(row['data'], `The data of stored event ${id}`),
    metadata: storedDataFrom(row['metadata'], `The metadata of stored event ${id}`),
    occurredAt: instantOf(row['occurred_at']),
    ...(tenantId === undefined ? {} : { tenantId }),
  };
}

function instantOf(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}
