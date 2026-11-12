import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read } from '../helpers';
import { EditedProject } from './edited-project';
import { bin, runIn } from './run-in';
import { FAILED_COUNT } from './run-specs';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const SHIPPING = 'src/contexts/shipping';
const CONTRACT = `${SHIPPING}/test/integration/invoices-to-ship.contract.spec.ts`;
/** The read model of tenant data the scaffold generates beside the table of an aggregate. */
const ORDERS = 'src/contexts/order-fulfilment';
/** The list of the read model tables the application checks when it starts. */
const LIST = 'src/platform/database/read-model-tables.ts';
const TENANT_CONTRACT = `${ORDERS}/test/integration/order-board.contract.spec.ts`;

/** A field of each type, one that may hold null: five required ones make a check too long for its line. */
const FIELDS = [
  'customerId:string',
  'total:decimal',
  'issuedAt:instant',
  'shippedAt:instant:nullable',
  'weight:number',
  'urgent:boolean',
];

/** What `generate read-model` wrote on an ORM, in shipping and, by the scaffold, in order-fulfilment. */
function generatedOn(orm: string): string[] {
  const tables = (context: string): string =>
    orm === 'knex' ? `create-${context}-tables.schema` : `${context}.schema`;

  return [
    `${SHIPPING}/application/ports/invoices-to-ship.port.ts`,
    `${SHIPPING}/infrastructure/persistence/${orm}-invoices-to-ship.repository.ts`,
    `${SHIPPING}/infrastructure/persistence/${tables('shipping')}.ts`,
    `${SHIPPING}/test/fakes/invoices-to-ship.fake.ts`,
    CONTRACT,
    `${ORDERS}/infrastructure/persistence/${orm}-order-board.repository.ts`,
    `${ORDERS}/infrastructure/persistence/${tables('order-fulfilment')}.ts`,
    TENANT_CONTRACT,
    LIST,
  ];
}

/** How a spec of the project runs one statement beside its stores, on each ORM. */
const RAW: Readonly<Record<string, readonly [imported: string, run: string]>> = {
  drizzle: [
    "import { sql } from 'drizzle-orm';\n",
    'database.persistence.database.executor().execute(sql.raw(statement))',
  ],
  knex: ['', 'database.persistence.database.executor().raw(statement)'],
};

/**
 * Appended to the contract spec of the read model, which opens the test database: the check the application
 * makes when it starts, on the tables as generated, then on a column put back to NOT NULL as an upgrade finds it.
 */
function tablesCheckOn(orm: string): string {
  const [imported, run] = RAW[orm] ?? ['', ''];

  return `
${imported}import { readModelTables } from '@/platform/database/read-model-tables';

describe('the read model tables of the database', () => {
  const column = 'alter table shipping.invoices_to_ship alter column customer_id';
  const alter = (statement: string): Promise<unknown> => Promise.resolve(${run});

  it('are ready as generated, and one that is not is refused by name, with its migration, by the root that hosts it', async () => {
    const tables = readModelTables(database.persistence);

    expect(await tables.notReady()).toEqual([]);
    expect((await tables.report()).text).toContain('shipping.invoices_to_ship');

    // The traces the contract left hold NULL there: the column is put back on an empty table.
    await database.reset();
    await alter(column + ' set not null');

    const refusal = await tables.require().catch((error: unknown) => error);
    // A root checks the tables of the contexts it hosts: the one that does not host shipping is not stopped by its table.
    const elsewhere = await readModelTables(database.persistence, ['order-fulfilment']).notReady();
    const own = await readModelTables(database.persistence, ['shipping']).notReady();

    await alter(column + ' drop not null');

    expect(elsewhere).toEqual([]);
    expect(own.map(({ table }) => table)).toEqual(['invoices_to_ship']);

    expect(String(refusal)).toContain('1 read model table is not ready for this version: shipping.invoices_to_ship.');
    expect(String(refusal)).toContain('alter table "shipping"."invoices_to_ship" alter column "customer_id" drop not null');
    expect(await tables.notReady()).toEqual([]);
  });
});
`;
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a read model as generated, installed as published, against the compiler, both
 * analyzers, the formatter and its own contract on the test database. Prisma and TypeORM, which this workspace
 * cannot run, are read by the compiler and the formatter in the sweeps of every stack.
 */
describe.runIf(SLOW).each(['drizzle', 'knex'])('a read model as generated, on %s', (orm) => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate(
      (root) => {
        const fields = FIELDS.flatMap((field) => ['--field', field]);

        // The first table of shipping: the read model starts the schema of the context.
        cli(root, 'generate', 'read-model', 'shipping', 'InvoicesToShip', ...fields);
        // A read model of the same name in a second context: its store carries the same class name.
        // On Knex: the tables of Drizzle are exported by name from one schema index, where two of a name collide.
        if (orm === 'knex') {
          cli(root, 'generate', 'read-model', 'billing', 'InvoicesToShip', '--field', 'weight:number');
        }
      },
      { ...DEFAULT_STACK, orm },
    );
  }, 240_000);

  afterEach(() => {
    project.restore();
  });

  it.runIf(orm === 'knex')(
    'lists the store of the same name of a second context under an alias, so that the list compiles',
    () => {
      expect(read(project.root, LIST)).toMatch(
        /import \{ (\w+InvoicesToShip) as Billing\1 \} from '@\/contexts\/billing\/infrastructure\/persistence\/[\w-]+\.repository';/,
      );

      expect(read(project.root, LIST)).toMatch(/\['billing', Billing\w+InvoicesToShip\],/);
    },
  );

  it('type-checks as generated: the ports, the store adapters over the read model store of the ORM package, the fakes, the contracts and the list of the tables', () => {
    const compiled = runIn(project.root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });

    expect(compiled).toBe('');
  }, 120_000);

  it('passes the checker, ESLint and the formatter as generated', () => {
    expect(project.checkedRules()).toEqual([]);
    expect(project.linted(...generatedOn(orm))).toBe('');
    expect(project.unformatted(...generatedOn(orm))).toBe('');
  }, 120_000);

  it('runs the contract on the fake and on the adapter, a field of each type read back as written, the later event pending', () => {
    const contract = runIn(project.root, { command: bin('vitest'), args: ['run', CONTRACT] });

    expect(contract).toMatch(/Tests\s+22 passed \|\s*2 todo/);
    expect(contract).not.toMatch(FAILED_COUNT);
  }, 120_000);

  it('keeps the rows of a tenant from another, in the contract of a read model of tenant data', () => {
    const contract = runIn(project.root, { command: bin('vitest'), args: ['run', TENANT_CONTRACT] });

    expect(contract).toMatch(/Tests\s+23 passed \|\s*2 todo/);
    expect(contract).not.toMatch(FAILED_COUNT);
  }, 120_000);

  it('finds every read model table ready as generated, and refuses by name one an upgrade left as it was', () => {
    project.append(CONTRACT, tablesCheckOn(orm));

    const contract = runIn(project.root, { command: bin('vitest'), args: ['run', CONTRACT] });

    expect(contract).toMatch(/Tests\s+23 passed \|\s*2 todo/);
    expect(contract).not.toMatch(FAILED_COUNT);
  }, 120_000);

  it('passes the whole contract on both once it is given a change', () => {
    project.edit(
      CONTRACT,
      '  // TODO(domain): add `change:',
      '  change: (row: InvoicesToShipRow) => ({ ...row, urgent: !row.urgent, shippedAt: null }),\n  // TODO(domain): add `change:',
    );

    const contract = runIn(project.root, { command: bin('vitest'), args: ['run', CONTRACT] });

    expect(contract).toMatch(/Tests\s+24 passed \(24\)/);
  }, 120_000);
});
