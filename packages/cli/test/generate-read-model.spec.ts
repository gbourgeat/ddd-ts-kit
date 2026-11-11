import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, read, write } from './helpers';
import { report } from './reports';
import { jsonAt } from './support/json-at';
import {
  BILLING,
  billingProject,
  CONTRACT,
  FAKE,
  PERSISTENCE,
  PORT,
  withInvoiceSummaries,
} from './support/read-model-project';

/** The store adapter each ORM gets: its file, its class and the store of the ORM package it extends. */
const STORES = [
  ['drizzle', 'drizzle-invoice-summaries', 'DrizzleInvoiceSummaries', 'DrizzleReadModelStore'],
  ['knex', 'knex-invoice-summaries', 'KnexInvoiceSummaries', 'KnexReadModelStore'],
  ['prisma', 'prisma-invoice-summaries', 'PrismaInvoiceSummaries', 'PrismaReadModelStore'],
  ['typeorm', 'type-orm-invoice-summaries', 'TypeOrmInvoiceSummaries', 'TypeOrmReadModelStore'],
  ['none', 'in-memory-invoice-summaries', 'InMemoryInvoiceSummaries', 'InMemoryReadModelStore'],
] as const;

describe.each(STORES)('generate read-model, on %s', (orm, file, adapter, store) => {
  const root = billingProject('--orm', orm);
  const generated = report(withInvoiceSummaries(root));
  const adapterFile = `${PERSISTENCE}/${file}.repository.ts`;

  it('writes the port, the store adapter, the fake and the contract both pass', () => {
    expect(generated.created).toEqual(expect.arrayContaining([PORT, adapterFile, FAKE, CONTRACT]));

    expect(read(root, adapterFile)).toContain(`@Repository(InvoiceSummaries)\nexport class ${adapter}`);
    expect(read(root, adapterFile)).toContain(`extends ${store}<InvoiceSummariesRow`);
    expect(read(root, adapterFile)).toContain('invoiceSummariesCriteria');

    expect(read(root, FAKE)).toContain(
      'export class FakeInvoiceSummaries extends InMemoryReadModelStore<InvoiceSummariesRow> implements InvoiceSummaries {',
    );

    expect(read(root, CONTRACT)).toContain(`name: '${adapter}',`);
    expect(read(root, CONTRACT)).toContain("name: 'FakeInvoiceSummaries',");
    expect(generated.notes.join('\n')).toContain(`FakeInvoiceSummaries (test/fakes) and ${adapter} pass the same`);
  });

  it('passes the checker with no finding, the suffix and the declaration of the adapter agreeing', () => {
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('is bound for describe and in the reference of CONTEXT.md', () => {
    expect(jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'ports')).toEqual([
      { name: 'InvoiceSummaries', kind: 'repository', adapters: [adapter], file: PORT },
    ]);

    expect(cli(root, 'describe', 'billing').stdout).toContain(`InvoiceSummaries [repository], by ${adapter}`);
    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain(`| \`InvoiceSummaries\` | repository | \`${adapter}\` |`);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });
});

describe('generate read-model, the port', () => {
  const root = billingProject();

  withInvoiceSummaries(root);

  it('types the row from the fields, a nullable one included, and declares each in the criteria', () => {
    const port = read(root, PORT);

    expect(port).toContain(
      [
        'export type InvoiceSummariesRow = {',
        '  readonly id: string;',
        '  readonly customerId: string;',
        '  readonly total: string;',
        '  readonly issuedAt: Date;',
        '  readonly paidAt: Date | null;',
        '  readonly lines: number;',
        '  readonly paid: boolean;',
        '};',
      ].join('\n'),
    );

    expect(port).toContain("    id: { type: 'string' },\n    customerId: { type: 'string' },\n");
    expect(port).toContain("    total: { type: 'decimal' },\n    issuedAt: { type: 'instant' },\n");
    expect(port).toContain("    paidAt: { type: 'instant', nullable: true },\n");
    expect(port).toContain("  tieBreaker: 'id',\n});");
    expect(port).toContain('export abstract class InvoiceSummaries extends ReadModelStore<InvoiceSummariesRow> {}');
  });

  it('gives the contract a sample row with a value of each type', () => {
    expect(read(root, CONTRACT)).toContain(
      [
        '  createRow: (key: string): InvoiceSummariesRow => ({',
        '    id: key,',
        '    customerId: `customerId of ${key}`,',
        "    total: '12.5',",
        "    issuedAt: new Date('2026-01-01T00:00:00.000Z'),",
        "    paidAt: new Date('2026-01-01T00:00:00.000Z'),",
        '    lines: 1,',
        '    paid: true,',
        '  }),',
      ].join('\n'),
    );
  });

  it('without a field leaves the row to its key, with the place to add the others', () => {
    const bare = billingProject();
    const generated = report(cli(bare, 'generate', 'read-model', 'billing', 'InvoiceSummaries', '--json'));

    expect(read(bare, PORT)).toContain('  readonly id: string;\n  // TODO(domain): add one field per thing a read of');

    expect(read(bare, CONTRACT)).toContain(
      '  createRow: (key: string): InvoiceSummariesRow => ({\n    id: key,\n  }),',
    );

    expect(generated.todos.map((todo) => todo.file)).toEqual(expect.arrayContaining([PORT, CONTRACT]));
    expect(checkJsonOf(cli(bare, 'check', '--json')).violations).toEqual([]);
  });
});

describe('describe, on a port file that declares more than its port', () => {
  it('names the port after its abstract class, not after the interface of the row written above it', () => {
    const root = billingProject();

    withInvoiceSummaries(root);

    write(
      root,
      PORT,
      read(root, PORT).replace('export type InvoiceSummariesRow = {', 'export interface InvoiceSummariesRow {'),
    );

    expect(jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'ports')).toEqual([
      expect.objectContaining({ name: 'InvoiceSummaries', adapters: ['DrizzleInvoiceSummaries'] }),
    ]);
  });
});
