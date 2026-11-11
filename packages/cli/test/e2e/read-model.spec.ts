import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli } from '../helpers';
import { EditedProject } from './edited-project';
import { bin, runIn } from './run-in';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const SHIPPING = 'src/contexts/shipping';
const PORT = `${SHIPPING}/application/ports/invoices-to-ship.port.ts`;
const ADAPTER = `${SHIPPING}/infrastructure/persistence/drizzle-invoices-to-ship.repository.ts`;
const SCHEMA = `${SHIPPING}/infrastructure/persistence/shipping.schema.ts`;
const FAKE = `${SHIPPING}/test/fakes/invoices-to-ship.fake.ts`;
const CONTRACT = `${SHIPPING}/test/integration/invoices-to-ship.contract.spec.ts`;
/** The read model of tenant data the scaffold generates beside the table of an aggregate. */
const ORDERS = 'src/contexts/order-fulfilment';
const TENANT_ADAPTER = `${ORDERS}/infrastructure/persistence/drizzle-order-board.repository.ts`;
const TENANT_SCHEMA = `${ORDERS}/infrastructure/persistence/order-fulfilment.schema.ts`;
const TENANT_CONTRACT = `${ORDERS}/test/integration/order-board.contract.spec.ts`;

const GENERATED = [PORT, ADAPTER, SCHEMA, FAKE, CONTRACT, TENANT_ADAPTER, TENANT_SCHEMA, TENANT_CONTRACT];

/** Slow, opt-in (DDD_TS_KIT_E2E=1): a read model as generated, installed as published, against the compiler, both analyzers, the formatter and its own contract on the test database. */
describe.runIf(SLOW)('a read model as generated', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate((root) => {
      // The first table of shipping: the read model starts the schema of the context.
      cli(
        root,
        'generate',
        'read-model',
        'shipping',
        'InvoicesToShip',
        '--field',
        'customerId:string',
        '--field',
        'total:decimal',
        '--field',
        'issuedAt:instant',
        '--field',
        'shippedAt:instant:nullable',
        '--field',
        'weight:number',
        '--field',
        'urgent:boolean',
      );
    });
  }, 240_000);

  afterEach(() => {
    project.restore();
  });

  it('type-checks as generated: the port, the store adapters over the read model store of the ORM package, the fakes and the contracts', () => {
    const compiled = runIn(project.root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });

    expect(compiled).toBe('');
  }, 120_000);

  it('passes the checker, ESLint and the formatter as generated', () => {
    expect(project.checkedRules()).toEqual([]);
    expect(project.linted(...GENERATED)).toBe('');
    expect(project.unformatted(...GENERATED)).toBe('');
  }, 120_000);

  it('runs the contract on the fake and on the adapter, a field of each type read back as written, the later event pending', () => {
    const contract = runIn(project.root, { command: bin('vitest'), args: ['run', CONTRACT] });

    expect(contract).toMatch(/Tests\s+14 passed \|\s*2 todo/);
    expect(contract).not.toMatch(/\b\d+ failed\b/);
  }, 120_000);

  it('keeps the rows of a tenant from another, in the contract of a read model of tenant data', () => {
    const contract = runIn(project.root, { command: bin('vitest'), args: ['run', TENANT_CONTRACT] });

    expect(contract).toMatch(/Tests\s+15 passed \|\s*2 todo/);
    expect(contract).not.toMatch(/\b\d+ failed\b/);
  }, 120_000);

  it('passes the whole contract on both once it is given a change', () => {
    project.edit(
      CONTRACT,
      '  // TODO(domain): add `change:',
      '  change: (row: InvoicesToShipRow) => ({ ...row, urgent: !row.urgent, shippedAt: null }),\n  // TODO(domain): add `change:',
    );

    const contract = runIn(project.root, { command: bin('vitest'), args: ['run', CONTRACT] });

    expect(contract).toMatch(/Tests\s+16 passed \(16\)/);
  }, 120_000);
});
