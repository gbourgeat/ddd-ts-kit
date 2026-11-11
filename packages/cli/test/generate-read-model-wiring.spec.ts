import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, read, write } from './helpers';
import { failure, report } from './reports';
import { expectOk } from './support/expect-ok';
import { jsonAt } from './support/json-at';
import {
  billingProject,
  BILLING,
  FAKE,
  generateReadModel,
  PERSISTENCE,
  PORT,
  withInvoiceSummaries,
} from './support/read-model-project';

const MODULE = `${BILLING}/billing.module.ts`;

describe('generate read-model, where the wiring is written', () => {
  it('in the explicit style binds the store adapter to its port in the module file, with what it is built from', () => {
    const root = billingProject('--style', 'explicit');
    const generated = report(withInvoiceSummaries(root));
    const module = read(root, MODULE);

    expect(generated.updated).toContain(MODULE);
    expect(read(root, `${PERSISTENCE}/drizzle-invoice-summaries.repository.ts`)).not.toContain('@Repository');

    expect(read(root, `${PERSISTENCE}/drizzle-invoice-summaries.repository.ts`)).toContain(
      'import {\n  invoiceSummariesCriteria,\n  type InvoiceSummaries,\n  type InvoiceSummariesRow,\n} from',
    );

    expect(module).toContain(
      "builder.bind(InvoiceSummaries).toClass(DrizzleInvoiceSummaries, [Database]).as('repository');",
    );

    expect(module).toContain("import { Database } from '@/platform/database/database';");
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);

    expect(jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'ports')).toEqual([
      expect.objectContaining({ name: 'InvoiceSummaries', kind: 'repository', adapters: ['DrizzleInvoiceSummaries'] }),
    ]);
  });

  it('in the explicit style gives a store of tenant data the scope of the work, and one in memory nothing', () => {
    const scoped = billingProject('--style', 'explicit', '--orm', 'knex');
    const inMemory = billingProject('--style', 'explicit', '--orm', 'none');

    withInvoiceSummaries(scoped, '--tenant-scoped');
    withInvoiceSummaries(inMemory);

    expect(read(scoped, MODULE)).toContain(
      "builder.bind(InvoiceSummaries).toClass(KnexInvoiceSummaries, [KnexContext, ExecutionScope]).as('repository');",
    );

    expect(read(inMemory, MODULE)).toContain(
      "builder.bind(InvoiceSummaries).toClass(InMemoryInvoiceSummaries).as('repository');",
    );
  });

  it('on a platform wired by hand says where to build the store, and leaves the module file as it is', () => {
    const root = billingProject('--di', 'manual', '--orm', 'knex');
    const module = read(root, MODULE);
    const plain = report(withInvoiceSummaries(root));
    const scoped = report(expectOk(generateReadModel(root, 'OverdueInvoices', '--tenant-scoped')));

    expect(read(root, MODULE)).toBe(module);

    expect(plain.notes.join('\n')).toContain(
      "platform.adapter(new KnexInvoiceSummaries(platform.persistence.database), { kind: 'repository', context: 'billing', token: 'InvoiceSummaries' })",
    );

    expect(scoped.notes.join('\n')).toContain('new KnexOverdueInvoices(platform.persistence.database, platform.scope)');
  });

  it('on a platform wired by hand without an ORM builds the store from nothing', () => {
    const root = billingProject('--di', 'manual', '--orm', 'none');

    expect(report(withInvoiceSummaries(root)).notes.join('\n')).toContain(
      'platform.adapter(new InMemoryInvoiceSummaries(), {',
    );
  });
});

describe('generate read-model, run again', () => {
  const root = billingProject();

  withInvoiceSummaries(root);

  it('adds nothing with the same fields, and refuses to declare the table again with others', () => {
    const tables = read(root, `${PERSISTENCE}/billing.schema.ts`);

    expectOk(generateReadModel(root, 'InvoiceSummaries'));
    expect(read(root, `${PERSISTENCE}/billing.schema.ts`)).toBe(tables);

    const refused = failure(generateReadModel(root, 'InvoiceSummaries', '--field', 'dueAt:instant'));

    expect(refused.message).toMatch(/already declares the table invoice_summaries, with other columns/);
    expect(refused.fix).toContain('with the row and the criteria of its port and the columns of its store adapter');
    expect(read(root, `${PERSISTENCE}/billing.schema.ts`)).toBe(tables);
  });

  it('lets a later table bear the name of one of its columns', () => {
    expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Line', '--term', 'Line=One billed item'));
    expectOk(cli(root, 'generate', 'repository', 'billing', 'Line'));

    expect(read(root, `${PERSISTENCE}/billing.schema.ts`)).toContain("billingSchema.table('lines', {");
  });
});

describe('generate read-model, what it refuses', () => {
  const root = billingProject();
  const refusal = (...args: string[]) => failure(cli(root, 'generate', 'read-model', 'billing', ...args, '--json'));

  it('refuses a field without a type of the criteria, one named twice and one the store keeps itself', () => {
    expect(refusal('InvoiceSummaries', '--field', 'total:money')).toMatchObject({
      message: '--field "total:money" is not a field with its type.',
      fix: expect.stringContaining('--field <name>:<string|number|boolean|instant|decimal>[:nullable]'),
    });

    expect(refusal('InvoiceSummaries', '--field', 'IssuedAt:instant').message).toContain('is not a field');

    expect(refusal('InvoiceSummaries', '--field', 'total:decimal', '--field', 'total:number').message).toBe(
      '--field names "total" twice.',
    );

    expect(refusal('InvoiceSummaries', '--field', 'tenantId:string')).toMatchObject({
      message: '--field "tenantId:string" names "tenantId", which the read model already holds.',
      fix: expect.stringContaining('The key of a row is `id`'),
    });
  });

  it('refuses a port of that name that is no read model, and leaves it as it was', () => {
    expectOk(cli(root, 'generate', 'port', 'billing', 'TaxRates'));

    const port = read(root, `${BILLING}/application/ports/tax-rates.port.ts`);
    const refused = refusal('TaxRates');

    expect(refused.message).toBe(
      `${BILLING}/application/ports/tax-rates.port.ts already declares the port TaxRates, which is not a read model.`,
    );

    expect(refused.fix).toContain('test/fakes/tax-rates.fake.ts');
    expect(read(root, `${BILLING}/application/ports/tax-rates.port.ts`)).toBe(port);
  });

  it('keeps a port that is already a read model, written by hand, and writes the rest around it', () => {
    const kept = [
      "import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';",
      '',
      'export type InvoiceSummariesRow = { readonly id: string };',
      '',
      "export const invoiceSummariesCriteria = defineCriteria<InvoiceSummariesRow>({ fields: {}, tieBreaker: 'id' });",
      '',
      'export abstract class InvoiceSummaries extends ReadModelStore<InvoiceSummariesRow> {}',
      '',
    ].join('\n');

    write(root, PORT, kept);

    const generated = report(cli(root, 'generate', 'read-model', 'billing', 'InvoiceSummaries', '--json'));

    expect(read(root, PORT)).toBe(kept);
    expect(generated.created).toContain(FAKE);
  });
});

describe('the generators around a read model', () => {
  const root = billingProject();

  withInvoiceSummaries(root);

  it('generate adapter refuses a remote adapter for the port of a read model, and names the command that fits', () => {
    const refused = failure(cli(root, 'generate', 'adapter', 'billing', 'InvoiceSummaries', '--json'));

    expect(refused.message).toBe(
      'InvoiceSummaries is the port of a read model: its adapter is a store over a table of "billing", not an adapter towards an outside system.',
    );

    expect(refused.fix).toContain('ddd-ts-kit generate read-model billing InvoiceSummaries');
  });

  it('generate projection names the command that writes the read model it keeps, in its note and in its file', () => {
    expectOk(cli(root, 'generate', 'integration-event', 'billing', 'Invoice', 'Issued', '--allow-name'));

    const generated = report(
      cli(root, 'generate', 'projection', 'billing', 'InvoiceSummaries', 'billing.invoice.issued', '--json'),
    );

    expect(generated.notes.join('\n')).toContain(
      'InvoiceSummariesProjection keeps a read model: `ddd-ts-kit generate read-model billing <Name> --field <name>:<type>`',
    );

    expect(read(root, `${BILLING}/application/projections/invoice-summaries.projection.ts`)).toContain(
      '`ddd-ts-kit generate read-model billing <Name> --field <name>:<type>` writes it with its table, its store adapter and its fake',
    );
  });
});
