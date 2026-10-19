import {
  atCommit,
  pageOf,
  unitOfWorkStage,
  type AuditEntry,
  type AuditFilter,
  type AuditReader,
  type AuditRecord,
  type AuditSortField,
  type AuditTrail,
  type Page,
  type PageRequest,
  type UnitOfWorkStage,
} from '@ddd-ts-kit/kernel';
import type { ChainHead } from '../chain/chain-head.js';
import { chainOfTenant } from '../chain/chain-of-tenant.js';
import { GENESIS_HASH } from '../chain/genesis-hash.js';
import { headAfter } from '../chain/head-after.js';
import { seal } from '../chain/seal.js';
import { sealCheckpoint } from '../chain/seal-checkpoint.js';
import { decodeCursor } from '../search/decode-cursor.js';
import { encodeCursor } from '../search/encode-cursor.js';
import type { SearchOrder } from '../search/search-order.js';
import { orderOf } from '../search/order-of.js';
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
 * ends, so two appends to one chain never read the same head and the chain cannot fork. Inside
 * a unit of work the records wait for its commit (`atCommit`): they are written last, each chain
 * once, the chains in the order of their names. The head is then the last lock a transaction
 * takes and every transaction takes the heads in one order, so an append never closes a
 * deadlock with the rows the work locked, nor with another chain. Under REPEATABLE READ or
 * SERIALIZABLE a second append fails with a serialization error instead of waiting: the caller
 * retries its unit of work, as for any other statement.
 */
export class PostgresAuditTrail implements AuditTrail, AuditReader {
  // What each unit of work in progress recorded and has not written yet, by its transaction.
  private readonly waiting = new WeakMap<object, AuditRecord[]>();

  constructor(
    private readonly session: () => SqlSession,
    private readonly tables: AuditTables,
    private readonly options: AuditTrailOptions = {},
  ) {}

  async record(record: AuditRecord): Promise<void> {
    const session = this.session();
    const transaction = session.ambientTransaction;

    if (transaction === undefined || !isBeforeCommit(unitOfWorkStage())) {
      return this.append(session, [record]);
    }

    const waiting = this.waiting.get(transaction);

    if (waiting !== undefined) {
      waiting.push(record);

      return;
    }

    const records = [record];

    this.waiting.set(transaction, records);

    await atCommit({
      apply: () => {
        // A record made after this point waits for a step of its own.
        this.waiting.delete(transaction);

        return this.append(this.stillIn(transaction) ?? this.session(), records);
      },
      undo: async () => undefined,
    });
  }

  async search(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>> {
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

  /**
   * The session of `transaction` while it is still the ambient one. A unit of work of another
   * database opened inside this one has ended before this commit: its records then go in a
   * transaction of their own, never on a connection that was handed back.
   */
  private stillIn(transaction: object): SqlSession | undefined {
    const session = this.session();

    return session.ambientTransaction === transaction ? session : undefined;
  }

  private async append(session: SqlSession, records: readonly AuditRecord[]): Promise<void> {
    const chainOf = this.options.chainOf ?? chainOfTenant;

    await session.transaction(async (transaction) => {
      for (const [chain, ofChain] of byChain(records, chainOf)) {
        await this.appendTo(transaction, chain, ofChain);
      }
    });
  }

  private async appendTo(transaction: SqlSession, chain: string, records: readonly AuditRecord[]): Promise<void> {
    let head = await this.lockHead(transaction, chain);

    for (const record of records) {
      const entry = seal(record, head);

      await transaction.query(insertOf(this.tables.entries, entry));
      await sealCheckpoint(entry, this.options.sealing);
      head = headAfter(entry);
    }

    await transaction.query(
      sql`update ${this.tables.chains} set "sequence" = ${head.sequence}, "hash" = ${head.hash} where "chain" = ${chain}`,
    );
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

  private async select(conditions: readonly Sql[], order: SearchOrder, limit: Sql): Promise<AuditEntry[]> {
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

function isBeforeCommit(stage: UnitOfWorkStage): boolean {
  return stage === 'open' || stage === 'before-commit';
}

/** The records of each chain in the order they were made, the chains in the order of their names. */
function byChain(records: readonly AuditRecord[], chainOf: (record: AuditRecord) => string): [string, AuditRecord[]][] {
  const chains = new Map<string, AuditRecord[]>();

  for (const record of records) {
    const chain = chainOf(record);

    chains.set(chain, [...(chains.get(chain) ?? []), record]);
  }

  return [...chains].sort(([left], [right]) => (left < right ? -1 : 1));
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
function afterCursor(cursor: string, order: SearchOrder): Sql {
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

function orderBy(order: SearchOrder): Sql {
  const direction = order.direction === 'asc' ? sql`asc` : sql`desc`;

  const columns =
    order.field === 'sequence' ? [sql`"chain"`, sql`"sequence"`] : [sql`"occurred_at"`, sql`"chain"`, sql`"sequence"`];

  return joined(
    columns.map((column) => sql`${column} ${direction}`),
    ', ',
  );
}
