import { EntitySchema, type EntitySchemaColumnOptions } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import {
  READ_MODEL_TABLE_SHAPES,
  readModelTablesContract,
  type ReadModelTableShape,
} from '@ddd-ts-kit/testing/contracts';
import { TypeOrmReadModelTable, createTypeOrmUnitOfWork, type ReadModelStamps } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

type Row = Record<string, string | null>;

const runner = { describe, it, expect, beforeEach, afterEach };
const { schema, ...tables } = READ_MODEL_TABLE_SHAPES;

const STAMPS = {
  lastEventId: 'last_event_id',
  lastEventAt: 'last_event_at',
  lastEventVersion: 'last_event_version',
  deleted: 'deleted',
};

/** The entity a project would write for a table of the contract: text fields, nullable unless the shape says the definition is not. */
function entityOf({ table, key, fields, tenant, stamps = STAMPS, required = [] }: ReadModelTableShape) {
  const mapped = [key, ...fields, ...(tenant === undefined ? [] : [tenant])];

  const columns: Record<string, EntitySchemaColumnOptions> = {
    ...Object.fromEntries(
      mapped.map((field) => [field, { type: 'text', primary: field === key, nullable: !required.includes(field) }]),
    ),
    lastEventId: { name: stamps.lastEventId, type: 'text' },
    lastEventAt: { name: stamps.lastEventAt, type: 'timestamptz' },
    lastEventVersion: { name: stamps.lastEventVersion, type: 'bigint', nullable: true },
    deleted: { name: stamps.deleted, type: 'boolean', default: false },
  };

  return new EntitySchema<Row & ReadModelStamps>({ name: table, tableName: table, schema, columns });
}

/** An entity is known to its data source once it is initialized: one per table of the contract, declared before. */
const entities = new Map(Object.values(tables).map(({ shape }) => [shape.table, entityOf(shape)]));

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([...entities.values()]);
});

afterAll(async () => {
  await database.close();
});

readModelTablesContract(runner, {
  name: 'TypeOrmReadModelTable',
  tenantColumn: true,
  renamedStamps: true,
  definition: true,
  createTables: () => {
    const unitOfWork = createTypeOrmUnitOfWork(database.dataSource);
    const scope = new FixedExecutionScope(anExecutionContext().ofTenant('acme').build());

    return {
      table: (shape) =>
        new TypeOrmReadModelTable<Row>(unitOfWork, {
          entity: entities.get(shape.table) ?? entityOf(shape),
          key: shape.key,
          ...(shape.tenant === undefined ? {} : { tenant: { scope, property: shape.tenant } }),
        }),
      execute: async (statement) => {
        const answered: unknown = await unitOfWork.manager().query(statement);
        const rows: readonly unknown[] = Array.isArray(answered) ? answered : [];

        return rows.filter(
          (row): row is Readonly<Record<string, unknown>> =>
            typeof row === 'object' && row !== null && !Array.isArray(row),
        );
      },
      transaction: (work) => unitOfWork.run(work),
    };
  },
});
