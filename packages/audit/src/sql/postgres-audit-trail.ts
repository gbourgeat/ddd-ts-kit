import {
  pageOf,
  type AuditEntry,
  type AuditFilter,
  type AuditReader,
  type AuditRecord,
  type AuditSortField,
  type AuditTrail,
  type Page,
  type PageRequest,
} from '@ddd-ts-kit/kernel';
import type { ChainHead } from '../chain/chain-head.js';
import { chainOfTenant } from '../chain/chain-of-tenant.js';
import { GENESIS_HASH } from '../chain/genesis-hash.js';
import { seal } from '../chain/seal.js';
import { sealCheckpoint } from '../chain/seal-checkpoint.js';
import { decodeCursor } from '../listing/decode-cursor.js';
import { encodeCursor } from '../listing/encode-cursor.js';
import type { ListOrder } from '../listing/list-order.js';
import { orderOf } from '../listing/order-of.js';
import type { AuditTrailOptions } from '../trail/audit-trail-options.js';
import type { AuditTables } from './audit-tables.js';
import { entryOf } from './entry-of.js';
import { insertOf } from './insert-of.js';
import type { SqlSession } from './sql-session.js';
import { joined, sql, type Sql } from './sql.js';

/**
 * The trail in PostgreSQL, whatever the query builder: the adapters give it a session, which
 * is the transaction of the unit of work in progress when there is one.
 *
 * An append locks the head row of its chain (`SELECT ... FOR UPDATE`) until its transaction
 * ends, so two appends to one chain never read the same head and the chain cannot fork. Under
 * REPEATABLE READ or SERIALIZABLE the second one fails with a serialization error instead of
 * waiting: the caller retries its unit of work, as for any other statement.
 */
export class PostgresAuditTrail implements AuditTrail, AuditReader {
  constructor(
    private readonly session: () => SqlSession,
    private readonly tables: AuditTables,
    private readonly options: AuditTrailOptions = {},
  ) {}

  async record(record: AuditRecord): Promise<void> {
    const chain = (this.options.chainOf ?? chainOfTenant)(record);

    await this.session().transaction(async (transaction) => {
      const entry = seal(record, await this.lockHead(transaction, chain));

      await transaction.query(insertOf(this.tables.entries, entry));

      await transaction.query(
        sql`update ${this.tables.chains} set "sequence" = ${entry.sequence}, "hash" = ${entry.hash} where "chain" = ${chain}`,
      );

      await sealCheckpoint(entry, this.options.sealing);
    });
  }

  async list(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>> {
    const order = orderOf(page);
    const matching = conditionsOf(filter);

    if (page.kind === 'offset') {
      const rows = await this.select(matching, order, sql`limit ${page.limit} offset ${page.offset}`);

      return pageOf(rows, { total: await this.count(matching) });
    }

    const resumed = page.cursor === undefined ? matching : [...matching, afterCursor(page.cursor, order)];
    const rows = await this.select(resumed, order, sql`limit ${page.limit + 1}`);
    const items = rows.slice(0, page.limit);
    const last = items.at(-1);

    return pageOf(items, rows.length > items.length && last !== undefined ? { nextCursor: encodeCursor(last) } : {});
  }

  private async lockHead(transaction: SqlSession, chain: string): Promise<ChainHead> {
    const { chains } = this.tables;

    await transaction.query(
      sql`insert into ${chains} ("chain", "sequence", "hash") values (${chain}, 0, ${GENESIS_HASH}) on conflict ("chain") do nothing`,
    );

    const [head] = await transaction.query(
      sql`select "sequence", "hash" from ${chains} where "chain" = ${chain} for update`,
    );

    const hash = head?.['hash'];

    if (typeof hash !== 'string') {
      throw new TypeError(`The head of audit chain "${chain}" could not be read`);
    }

    return { chain, sequence: Number(head?.['sequence']), hash };
  }

  private async select(conditions: readonly Sql[], order: ListOrder, limit: Sql): Promise<AuditEntry[]> {
    const statement = sql`select * from ${this.tables.entries} ${where(conditions)} order by ${orderBy(order)} ${limit}`;

    return (await this.session().query(statement)).map(entryOf);
  }

  private async count(conditions: readonly Sql[]): Promise<number> {
    const [row] = await this.session().query(
      sql`select count(*) as "total" from ${this.tables.entries} ${where(conditions)}`,
    );

    return Number(row?.['total']);
  }
}

function conditionsOf(filter: AuditFilter): Sql[] {
  const equalities: readonly (readonly [Sql, string | undefined])[] = [
    [sql`"chain"`, filter.chain],
    [sql`"tenant_id"`, filter.tenantId],
    [sql`"actor_id"`, filter.actorId],
    [sql`"resource_type"`, filter.resource?.type],
    [sql`"resource_id"`, filter.resource?.id],
    [sql`"action"`, filter.action],
    [sql`"category"`, filter.category],
    [sql`"outcome"`, filter.outcome],
    [sql`"correlation_id"`, filter.correlationId],
  ];

  const equal = equalities.flatMap(([column, value]) => (value === undefined ? [] : [sql`${column} = ${value}`]));

  return [...equal, ...rangesOf(filter)];
}

function rangesOf({ from, to, fromSequence, toSequence }: AuditFilter): Sql[] {
  return [
    ...(from === undefined ? [] : [sql`"occurred_at" >= ${from.toISOString()}::timestamptz`]),
    ...(to === undefined ? [] : [sql`"occurred_at" < ${to.toISOString()}::timestamptz`]),
    ...(fromSequence === undefined ? [] : [sql`"sequence" >= ${fromSequence}`]),
    ...(toSequence === undefined ? [] : [sql`"sequence" <= ${toSequence}`]),
  ];
}

/** A row comparison: the three columns move together, in the direction of the order. */
function afterCursor(cursor: string, order: ListOrder): Sql {
  const { occurredAt, chain, sequence } = decodeCursor(cursor);
  const beyond = order.direction === 'asc' ? sql`>` : sql`<`;

  if (order.field === 'sequence') {
    return sql`("chain", "sequence") ${beyond} (${chain}, ${sequence}::bigint)`;
  }

  return sql`("occurred_at", "chain", "sequence") ${beyond} (${occurredAt.toISOString()}::timestamptz, ${chain}, ${sequence}::bigint)`;
}

function where(conditions: readonly Sql[]): Sql {
  return conditions.length === 0 ? sql`` : sql`where ${joined(conditions, ' and ')}`;
}

function orderBy(order: ListOrder): Sql {
  const direction = order.direction === 'asc' ? sql`asc` : sql`desc`;

  const columns =
    order.field === 'sequence' ? [sql`"chain"`, sql`"sequence"`] : [sql`"occurred_at"`, sql`"chain"`, sql`"sequence"`];

  return joined(
    columns.map((column) => sql`${column} ${direction}`),
    ', ',
  );
}
