import type { TouchedKey } from '../../application/read-model/touched-key';
import type { SqlRun } from './sql-run';

export interface RebuiltTable {
  readonly schema?: string;
  readonly table: string;
  /** The column that marks a deleted row. Default `deleted`. */
  readonly deletedColumn?: string;
}

/**
 * The rebuild steps of a read model table on PostgreSQL, shared by the ORM adapters, which
 * differ only in how they run a statement. The copy is `<table>__rebuild`, created `LIKE` the
 * table with its indexes and constraints; the keys written meanwhile go to `<table>__touched`,
 * whose existence is what tells writers that a rebuild is in progress. Identifiers come from
 * the adapter's options and are quoted; every value is a bound parameter.
 */
export class PostgresReadModelRebuild {
  private readonly live: string;

  private readonly copy: string;

  private readonly keys: string;

  constructor(
    private readonly run: SqlRun,
    private readonly target: RebuiltTable,
  ) {
    this.live = this.qualified(target.table);
    this.copy = this.qualified(PostgresReadModelRebuild.shadowOf(target.table));
    this.keys = this.qualified(`${target.table}__touched`);
  }

  static shadowOf(table: string): string {
    return `${table}__rebuild`;
  }

  async rebuilding(): Promise<boolean> {
    const [row] = await this.run('select to_regclass($1) is not null as rebuilding', [this.keys]);

    return row?.['rebuilding'] === true;
  }

  async touch(key: string): Promise<void> {
    await this.run(
      `insert into ${this.keys} as touched ("key") values ($1) on conflict ("key") do update set "mark" = touched."mark" + 1`,
      [key],
    );
  }

  async begin(): Promise<void> {
    const deleted = quoted(this.target.deletedColumn ?? 'deleted');

    await this.run(`create table ${this.copy} (like ${this.live} including all)`, []);
    await this.run(`insert into ${this.copy} select * from ${this.live} where ${deleted}`, []);
    await this.run(`create table ${this.keys} ("key" text primary key, "mark" integer not null default 1)`, []);
  }

  async touched(limit: number): Promise<readonly TouchedKey[]> {
    const rows = await this.run(`select "key", "mark" from ${this.keys} order by "key" limit $1`, [limit]);

    return rows.map((row) => ({ key: String(row['key']), mark: Number(row['mark']) }));
  }

  async settle(keys: readonly TouchedKey[]): Promise<void> {
    for (const { key, mark } of keys) {
      await this.run(`delete from ${this.keys} where "key" = $1 and "mark" = $2`, [key, mark]);
    }
  }

  /** The touched keys first, in every transaction: a writer records its key before it writes. */
  async holdWriters(): Promise<void> {
    await this.run(`lock table ${this.keys}, ${this.live} in access exclusive mode`, []);
  }

  async promote(): Promise<void> {
    const { table } = this.target;
    const retired = `${table}__retired`;

    await this.run(`alter table ${this.live} rename to ${quoted(retired)}`, []);
    await this.run(`alter table ${this.copy} rename to ${quoted(table)}`, []);
    await this.run(`drop table ${this.qualified(retired)}`, []);
    await this.run(`drop table ${this.keys}`, []);
  }

  async abandon(): Promise<void> {
    await this.run(`drop table if exists ${this.keys}`, []);
    await this.run(`drop table if exists ${this.copy}`, []);
  }

  private qualified(table: string): string {
    const { schema } = this.target;

    return schema === undefined ? quoted(table) : `${quoted(schema)}.${quoted(table)}`;
  }
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
