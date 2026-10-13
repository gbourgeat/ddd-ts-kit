import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';
import { AsyncLocalStorageExecutionScope, InvalidTenantIdError, TENANT_ISOLATION_POLICIES } from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant, scoped } from '@ddd-ts-kit/testing';
import { tenantIsolationContract } from '@ddd-ts-kit/testing/contracts';
import { createKnexUnitOfWork, enableTenantIsolation, tenantSession, type KnexUnitOfWork } from '../src/index.js';
import { Invoice } from './support/billing-core/domain/invoice.js';
import { BILLING } from './support/billing-core/infrastructure/persistence/billing-schema.js';
import { createInvoicesTable } from './support/billing-core/infrastructure/persistence/create-invoices-table.js';
import { createDatabase, type TestDatabase } from './support/database.js';
import { asApplicationRole } from './support/tenancy/as-role.js';
import { inUnitOfWork } from './support/tenancy/in-unit-of-work.js';
import { SHARED_TABLES, UNFILTERED } from './support/tenancy/invoice-tables.js';
import { StrategyInvoiceRepository } from './support/tenancy/strategy-invoice-repository.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const INVOICES = { table: 'invoices', schema: BILLING };

/*
 * The application connects as a role of its own: a superuser ignores every policy. On PGlite every
 * connection shares one session, so from the first statement of that role on, the whole file
 * runs as it, which is what a deployed application does.
 */
let database: TestDatabase;
let application: Knex;
let next = 0;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createInvoicesTable(knex);
      await enableTenantIsolation(knex, INVOICES);
    },
    [`${BILLING}.invoices`],
  );

  application = await asApplicationRole(database, [BILLING]);
});

afterAll(async () => {
  await application.destroy();
  await database.close();
});

const truncate = () => application.withSchema(BILLING).table('invoices').truncate();

const invoices = {
  createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
  recreate: (invoice: Invoice) => Invoice.draft(invoice.id, 100),
  mutate: (invoice: Invoice) => invoice.addCharge(50),
  idOf: (invoice: Invoice) => invoice.id,
  stateOf: (invoice: Invoice) => invoice.state,
  elevatedReads: true,
};

tenantIsolationContract<Invoice>(runner, {
  ...invoices,
  name: 'knex, shared tables under row-level security',
  createRepository: async (scope) => {
    await truncate();

    const context = createKnexUnitOfWork(application, undefined, { begin: tenantSession(scope) });

    return inUnitOfWork(new StrategyInvoiceRepository({ context, scope, tables: SHARED_TABLES }), context);
  },
});

tenantIsolationContract<Invoice>(runner, {
  ...invoices,
  name: 'knex, row-level security alone, statements without a tenant condition',
  createRepository: async (scope) => {
    await truncate();

    const context = createKnexUnitOfWork(application, undefined, { begin: tenantSession(scope) });

    return inUnitOfWork(new StrategyInvoiceRepository({ context, scope, tables: UNFILTERED }), context);
  },
});

describe('row-level security', () => {
  const scope = new AsyncLocalStorageExecutionScope();

  const unitOfWork = (): KnexUnitOfWork =>
    createKnexUnitOfWork(application, undefined, { begin: tenantSession(scope) });

  const invoicesIn = (context: KnexUnitOfWork) => context.executor().withSchema(BILLING).table('invoices');

  beforeEach(async () => {
    await truncate();

    for (const [id, tenantId] of [
      ['inv-a', 'acme'],
      ['inv-g', 'globex'],
    ] as const) {
      const context = unitOfWork();

      await asTenant(scope, tenantId, () => context.run(() => invoicesIn(context).insert(invoiceRow(id, tenantId))));
    }
  });

  it('shows a statement without a tenant condition the rows of its tenant only', async () => {
    const context = unitOfWork();
    const rows = await asTenant(scope, 'acme', () => context.run(() => invoicesIn(context).select('id')));

    expect(rows).toEqual([{ id: 'inv-a' }]);
  });

  it('refuses a write that names another tenant', async () => {
    const context = unitOfWork();

    const write = asTenant(scope, 'acme', () =>
      context.run(() => invoicesIn(context).insert(invoiceRow('inv-x', 'globex'))),
    );

    await expect(write).rejects.toThrow('row-level security');
  });

  it('shows nothing to work outside of a transaction, or that names no tenant', async () => {
    const outside = await asTenant(scope, 'acme', () => application.withSchema(BILLING).table('invoices').select('id'));
    const context = unitOfWork();
    const job = await scoped(scope, anExecutionContext(), () => context.run(() => invoicesIn(context).select('id')));

    expect(outside).toEqual([]);
    expect(job).toEqual([]);
  });

  it('lets an elevated statement read every reached tenant, and update or delete none but its own', async () => {
    const context = unitOfWork();
    const elevated = anExecutionContext().ofTenant('initech').elevatedOver(['acme', 'globex']);

    const seen = await scoped(scope, elevated, () =>
      context.run(async () => {
        await invoicesIn(context).update({ tenant_id: 'initech', amount: 0 });
        await invoicesIn(context).delete();

        return invoicesIn(context).select('id', 'amount').orderBy('id');
      }),
    );

    expect(seen).toEqual([
      { id: 'inv-a', amount: 1 },
      { id: 'inv-g', amount: 1 },
    ]);
  });

  it('refuses a context whose tenant id could widen the reach, before any SQL', async () => {
    for (const tenantId of ['*', 'acme,globex', 'acme:products']) {
      const context = unitOfWork();
      const forged = { ...anExecutionContext().build(), tenantId };

      await expect(scoped(scope, forged, () => context.run(async () => undefined))).rejects.toThrow(
        InvalidTenantIdError,
      );
    }
  });

  it('sets the tenant for the transaction only, never for the next one on the connection', async () => {
    const context = unitOfWork();

    await asTenant(scope, 'acme', () => context.run(async () => undefined));

    const after = await application.raw<{ rows: { tenant: string | null }[] }>(
      "select current_setting('ddd_ts_kit.tenant_id', true) as tenant",
    );

    expect(after.rows[0]?.tenant ?? '').toBe('');
  });
});

describe('the policy of a table', () => {
  it('is enabled, forced on the owner, and one per command', async () => {
    const policies = await application.raw<{ rows: { policyname: string; cmd: string }[] }>(
      "select policyname, cmd from pg_policies where schemaname = ? and tablename = 'invoices' order by policyname",
      [BILLING],
    );

    const flags = await application.raw<{ rows: { relrowsecurity: boolean; relforcerowsecurity: boolean }[] }>(
      'select relrowsecurity, relforcerowsecurity from pg_class where oid = ?::regclass',
      [`${BILLING}.invoices`],
    );

    expect(policies.rows).toEqual([
      { policyname: TENANT_ISOLATION_POLICIES.delete, cmd: 'DELETE' },
      { policyname: TENANT_ISOLATION_POLICIES.insert, cmd: 'INSERT' },
      { policyname: TENANT_ISOLATION_POLICIES.select, cmd: 'SELECT' },
      { policyname: TENANT_ISOLATION_POLICIES.update, cmd: 'UPDATE' },
    ]);

    expect(flags.rows).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);
  });
});

function invoiceRow(id: string, tenantId: string): Record<string, unknown> {
  const at = new Date('2026-03-01T10:00:00.000Z');

  return {
    id,
    amount: 1,
    status: 'draft',
    version: 1,
    tenant_id: tenantId,
    created_at: at,
    created_by: 'seed',
    updated_at: at,
    updated_by: 'seed',
  };
}
