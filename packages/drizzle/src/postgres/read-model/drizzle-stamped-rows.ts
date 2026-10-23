import { sql, type SQL, type TablesRelationalConfig } from 'drizzle-orm';
import type { PgColumn, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { tenantScopeOf, type EventStamp, type ReadModelRows, type StampedRow } from '@ddd-ts-kit/kernel';
import { reachCondition } from '../tenancy/reach-condition';
import type { ReadModelTenant } from './read-model-tenant';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';
import { RowMapper } from './row.mapper';
import { rowsOf } from './rows-of';
import type { StampColumns } from './stamp-columns';

export interface StampedTable {
  readonly schema: string | undefined;
  readonly name: string;
  readonly key: PgColumn;
  readonly columns: Readonly<Record<string, PgColumn>>;
  readonly stamps: StampColumns;
  readonly tenant?: ReadModelTenant;
}

/**
 * The stamped rows of one table, the copy of a rebuild as well as the table itself: the
 * table is named, since the copy has no drizzle definition of its own. Identifiers are quoted
 * by drizzle and every value is a parameter.
 */
export class DrizzleStampedRows<
  Row extends object,
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
> implements ReadModelRows<Row>
{
  private readonly mapper: RowMapper<Row>;

  constructor(
    private readonly context: DrizzleContext<Q, F, S>,
    private readonly target: StampedTable,
  ) {
    this.mapper = new RowMapper<Row>(target.columns);
  }

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const { stamps } = this.target;

    const [record] = rowsOf(
      await this.context
        .executor()
        .execute(
          sql`select * from ${this.table()} where ${named(this.target.key)} = ${key} and ${this.reach()} limit 1`,
        ),
    );

    if (record === undefined) {
      return undefined;
    }

    const version = record[stamps.lastEventVersion.name];

    return {
      key,
      row: record[stamps.deleted.name] === true ? undefined : this.mapper.toRow(record),
      stamp: {
        eventId: String(record[stamps.lastEventId.name]),
        occurredAt: new Date(String(record[stamps.lastEventAt.name])),
        ...(version === null || version === undefined ? {} : { version: Number(version) }),
      },
    };
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    if (entry.row === undefined) {
      return false;
    }

    const values = this.valuesOf(entry);

    const columns = sql.join(
      values.map(([column]) => named(column)),
      sql`, `,
    );

    const written = sql.join(
      values.map(([, value]) => sql`${value}`),
      sql`, `,
    );

    const key = named(this.target.key);

    const inserted = await this.context
      .executor()
      .execute(
        sql`insert into ${this.table()} (${columns}) values (${written}) on conflict (${key}) do nothing returning ${key}`,
      );

    return rowsOf(inserted).length === 1;
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const { stamps } = this.target;

    const changes = sql.join(
      this.valuesOf(entry).map(([column, value]) => sql`${named(column)} = ${value}`),
      sql`, `,
    );

    const key = named(this.target.key);

    const replaced = await this.context
      .executor()
      .execute(
        sql`update ${this.table()} set ${changes} where ${key} = ${entry.key} and ${named(stamps.lastEventId)} = ${held.eventId} and ${named(stamps.lastEventAt)} = ${held.occurredAt.toISOString()} and ${this.own()} returning ${key}`,
      );

    return rowsOf(replaced).length === 1;
  }

  /** What a read may reach: every row, or those of the tenants of the work for a read model of tenant data. */
  private reach(): SQL {
    const { tenant } = this.target;

    return tenant === undefined ? sql`true` : reachCondition(named(tenant.column), tenant.scope);
  }

  private own(): SQL {
    const { tenant } = this.target;

    return tenant === undefined ? sql`true` : sql`${named(tenant.column)} = ${tenantScopeOf(tenant.scope).tenantId}`;
  }

  private valuesOf({ key, row, stamp }: StampedRow<Row>): [PgColumn, unknown][] {
    const { stamps, tenant } = this.target;

    const written =
      row === undefined
        ? []
        : this.mapper.toValues(row).filter(([column]) => column !== this.target.key && column !== tenant?.column);

    return [
      ...written,
      [this.target.key, key],
      [stamps.lastEventId, stamp.eventId],
      [stamps.lastEventAt, stamp.occurredAt.toISOString()],
      [stamps.lastEventVersion, stamp.version ?? null],
      [stamps.deleted, row === undefined],
      ...this.tenantValue(),
    ];
  }

  /** The tenant of a written row, for a read model of tenant data. */
  private tenantValue(): [PgColumn, unknown][] {
    const { tenant } = this.target;

    return tenant === undefined ? [] : [[tenant.column, tenantScopeOf(tenant.scope).tenantId]];
  }

  private table(): SQL {
    const { schema, name } = this.target;

    return schema === undefined ? sql`${sql.identifier(name)}` : sql`${sql.identifier(schema)}.${sql.identifier(name)}`;
  }
}

function named(column: PgColumn): SQL {
  return sql`${sql.identifier(column.name)}`;
}
