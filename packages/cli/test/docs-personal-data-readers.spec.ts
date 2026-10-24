import { describe, expect, it } from 'vitest';
import { ensurePersonalDataRegion } from '../src/docs/ensure-personal-data-region';
import type { ContextFacts } from '../src/docs/context-facts';
import { personalDataLines } from '../src/docs/personal-data-lines';
import { privacyRegisterLines } from '../src/docs/privacy-register-lines';
import { readPersonalData } from '../src/docs/read-personal-data';
import { Workspace } from '../src/workspace';
import { tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
const FLAT = { directory: BILLING, modules: [] };

function workspaceWith(files: Readonly<Record<string, string>>): Workspace {
  const root = tempDir('docs-personal-data');

  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }

  return new Workspace(root, false);
}

function declared(files: Readonly<Record<string, string>>): ReturnType<typeof readPersonalData> {
  return readPersonalData(workspaceWith(files), FLAT);
}

describe('the personal data of a context, as the documentation reads its declarations', () => {
  it('reads the columns of a Drizzle table written over several lines and of a TypeORM entity schema', () => {
    const tables = declared({
      [`${PERSISTENCE}/billing.schema.ts`]: [
        'export const invoices = billingSchema.table(',
        "  'invoices',",
        '  {',
        "    customerId: text('customer_id'),",
        '    customerEmail: text("customer_email"),',
        "    closedAt: timestamp('closed_at'),",
        '  },',
        ');',
        'export const payers = new EntitySchema<PayerRow>({',
        "  name: 'BillingPayer',",
        "  tableName: 'payers',",
        "  columns: { holderName: { name: 'holder_name', type: 'text' } },",
        '});',
      ].join('\n'),
      [`${PERSISTENCE}/invoice.personal-fields.ts`]: [
        '// personalFields(nothing) in a comment is not a declaration',
        "const declaration = { subject: 'customerId', fields: [\"customerEmail\"], erasure: 'row', retention: { after: 'closedAt', years: 1 } };",
        'export const InvoicePersonalFields = personalFields<InvoiceRow>(invoices, declaration);',
        "export const PayerPersonalFields = personalFields(payers, { subject: 'id', fields: ['holderName', 'unmapped'], erasure: 'pseudonymise' });",
      ].join('\n'),
    });

    expect(tables).toEqual([
      {
        file: `${PERSISTENCE}/invoice.personal-fields.ts`,
        table: 'invoices',
        subject: 'customer_id',
        fields: ['customer_email'],
        files: [],
        erasure: 'row',
        retention: '1 year after closed_at',
      },
      {
        file: `${PERSISTENCE}/invoice.personal-fields.ts`,
        table: 'payers',
        subject: 'id',
        fields: ['holder_name', 'unmapped'],
        files: [],
        erasure: 'pseudonymise',
      },
    ]);
  });

  it('keeps the table as written when nothing of the context defines it, and leaves out a call it cannot read', () => {
    const tables = declared({
      [`${PERSISTENCE}/customer.personal-fields.ts`]: [
        "export const A = personalFields(tables.customers, { subject: 'id', fields: ['email'], erasure: 'row', retention: { after: 'ended_at' } });",
        "export const B = personalFields(imported, { subject: 'id', fields: ['name'], erasure: 'row' });",
        'export const C = personalFields(TABLE, missingOptions);',
        'export const D = personalFields(TABLE);',
        'export const E = personalFields(TABLE, ...spread);',
      ].join('\n'),
      [`${PERSISTENCE}/customer.mapper.ts`]: 'export const unrelated = 1;',
    });

    expect(tables.map(({ table, retention }) => ({ table, retention }))).toEqual([
      { table: 'tables.customers', retention: undefined },
      { table: 'imported', retention: undefined },
    ]);
  });
});

describe('the personal data section of a CONTEXT.md', () => {
  it('is added before the permissions, before the reference without them, at the end without either, and once', () => {
    const section = '## Personal data\n\n<!-- ddd-ts-kit:personal-data -->\n<!-- /ddd-ts-kit:personal-data -->\n';

    expect(ensurePersonalDataRegion('# Billing\n\n## Permissions\n')).toBe(`# Billing\n\n${section}\n## Permissions\n`);
    expect(ensurePersonalDataRegion('# Billing\n\n## Reference\n')).toBe(`# Billing\n\n${section}\n## Reference\n`);
    expect(ensurePersonalDataRegion('# Billing\n\n')).toBe(`# Billing\n\n${section}`);
    expect(ensurePersonalDataRegion(`# Billing\n\n${section}`)).toBe(`# Billing\n\n${section}`);
  });

  it('lists the events that carry personal data even when no table declares any', () => {
    expect(
      personalDataLines({
        personalData: [],
        publishedEvents: [
          {
            type: 'billing.invoice.issued',
            version: 2,
            personal: { subject: 'customerId', fields: ['email', 'address.city'] },
          },
          { type: 'billing.invoice.paid', version: 1 },
        ],
      }),
    ).toEqual([
      'No table declares personal data.',
      '',
      'Published in:',
      '',
      '- `billing.invoice.issued` (version 2): `email`, `address.city`, about `customerId`',
    ]);
  });
});

describe('the register of personal data', () => {
  it('says when the producer of an event that carries personal data has no context declared downstream', () => {
    const billing: Pick<ContextFacts, 'name' | 'personalData' | 'publishedEvents' | 'downstreams'> = {
      name: 'billing',
      personalData: [],
      publishedEvents: [
        { type: 'billing.invoice.issued', version: 1, personal: { subject: 'customerId', fields: ['email'] } },
      ],
      downstreams: [],
    };

    expect(privacyRegisterLines([billing])).toContain(
      '| `billing.invoice.issued` (version 1) | billing | `customerId` | `email` | none declared |',
    );
  });
});
