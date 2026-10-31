import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const REGISTER = 'docs/privacy/register.md';
const CONTEXT = 'src/contexts/billing/CONTEXT.md';
const DECLARATION = 'src/contexts/billing/infrastructure/persistence/invoice.personal-fields.ts';
const LANGUAGE = 'src/contexts/billing/published-language';
const RETAINED = ['--personal', 'customer_email,customer_name', '--retention', 'closed_at:3y'];

const INVOICES_ROW =
  '| `invoices` | `id` | `customer_email`, `customer_name` | pseudonymised | 3 years after `closed_at` |';

function rewrite(root: string, file: string, change: (content: string) => string): void {
  writeFileSync(path.join(root, file), change(read(root, file)));
}

/** Declares the email of the customer as the personal data of the payload of the first event of billing. */
function personalEvent(root: string): void {
  expectOk(
    cli(
      root,
      'generate',
      'integration-event',
      'billing',
      'Invoice',
      'Issued',
      '--term',
      'Issued=Sent to the customer for payment',
    ),
  );

  const event = readdirSync(path.join(root, LANGUAGE)).find((name) => name.endsWith('.integration-event.ts'));

  rewrite(root, `${LANGUAGE}/${event ?? ''}`, (content) =>
    content.replace(
      '  version: 1,\n',
      "  version: 1,\n  personal: { subject: 'invoiceId', fields: ['customerEmail'] },\n",
    ),
  );
}

describe('docs: the register of personal data', () => {
  it('is written by init with --privacy on, its tables empty and the sections of the controller to fill', () => {
    const register = read(initProject(), REGISTER);

    expect(register).toContain('No context declares a table that keeps personal data.');
    expect(register).toContain('No integration event declares personal data in its payload.');
    expect(register).toContain('It is not the record of processing activities of GDPR article 30');
    expect(register).toContain('## Purposes and lawful basis\n\nTODO(domain):');
  });

  it('says that a value a cached read keeps of a person lasts its time to live', () => {
    expect(read(initProject(), REGISTER)).toContain(
      'a value a `cached` read keeps of a person, until its time to live',
    );
  });

  it('is not written with --privacy off', () => {
    expect(exists(initProject('--privacy', 'off'), REGISTER)).toBe(false);
  });

  it('lists each declared table across the contexts once generate repository --personal wrote it, and docs --check holds it', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex'], RETAINED);

    expect(read(root, REGISTER)).toContain(
      '| Context | Table | About | Personal data | On erasure | Kept |\n|---|---|---|---|---|---|\n| billing ' +
        INVOICES_ROW,
    );

    expect(read(root, CONTEXT)).toContain(
      `## Personal data\n\n<!-- ddd-ts-kit:personal-data -->\n| Table | About | Personal data | On erasure | Kept |\n|---|---|---|---|---|\n${INVOICES_ROW}\n<!-- /ddd-ts-kit:personal-data -->`,
    );

    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it.each([
    ['drizzle', '--orm', 'drizzle'],
    ['typeorm', '--orm', 'typeorm'],
    ['prisma', '--orm', 'prisma'],
  ])('reads the table of a declaration on %s from the schema that defines it', (_, ...flags) => {
    expect(read(billingWithPersonalInvoices(flags, RETAINED), REGISTER)).toContain(`| billing ${INVOICES_ROW}`);
  });
});

describe('docs: where personal data leaves its context, and declarations written by hand', () => {
  it('says which events carry personal data out of their context, and to which contexts downstream', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex'], ['--personal', 'customer_email', '--erasure', 'row']);

    personalEvent(root);

    expectOk(
      cli(
        root,
        'generate',
        'context',
        'shipping',
        '--classification',
        'supporting',
        '--purpose',
        'Ships orders.',
        '--upstream',
        'billing:published-language',
      ),
    );

    expectOk(cli(root, 'docs'));

    expect(read(root, REGISTER)).toContain(
      '| `billing.invoice.issued` (version 1) | billing | `invoiceId` | `customerEmail` | shipping |',
    );

    expect(read(root, REGISTER)).toContain(
      '| billing | `invoices` | `id` | `customer_email` | row deleted | until erased |',
    );

    expect(read(root, CONTEXT)).toContain(
      'Published in:\n\n- `billing.invoice.issued` (version 1): `customerEmail`, about `invoiceId`',
    );
  });

  it('writes a retention read from configuration as configured, never as until erased', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    rewrite(root, DECLARATION, (content) =>
      content.replace(/erasure: '(\w+)'/, "erasure: '$1', configuredRetention: 'RETENTION_PERIODS'"),
    );

    expectOk(cli(root, 'docs'));

    expect(read(root, REGISTER)).toContain('| pseudonymised | configured by `RETENTION_PERIODS` |');
    expect(read(root, REGISTER)).not.toContain('until erased');
  });

  it('fails docs --check when a declaration changed by hand, and keeps what the team wrote around the markers', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    rewrite(root, REGISTER, (content) =>
      content.replace('TODO(domain): for each context above', 'Billing: the contract.'),
    );

    rewrite(root, DECLARATION, (content) =>
      content.replace("fields: ['customer_email', 'customer_name']", "fields: ['customer_email']"),
    );

    expect(cli(root, 'docs', '--check').code).toBe(1);

    expectOk(cli(root, 'docs'));

    expect(read(root, REGISTER)).toContain(
      '| billing | `invoices` | `id` | `customer_email` | pseudonymised | until erased |',
    );

    expect(read(root, REGISTER)).toContain('Billing: the contract.');
  });

  it('reads a declaration written by hand, several tables in one file, and adds the section to a CONTEXT.md that has none', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    rewrite(root, CONTEXT, (content) =>
      content.replace(
        /## Personal data\n\n<!-- ddd-ts-kit:personal-data -->[\s\S]*?<!-- \/ddd-ts-kit:personal-data -->\n\n/,
        '',
      ),
    );

    writeFileSync(
      path.join(root, 'src/contexts/billing/infrastructure/persistence/payment.personal-fields.ts'),
      [
        "import { personalFields } from '@ddd-ts-kit/kernel';",
        '',
        "export const CardPersonalFields = personalFields({ schema: 'billing', table: 'cards' }, {",
        "  subject: 'holder_id',",
        "  fields: ['holder_name'],",
        "  files: ['scan_key'],",
        "  erasure: 'row',",
        "  retention: { months: 13, after: 'expired_at' },",
        '});',
        '',
        "export const PayerPersonalFields = personalFields({ schema: 'billing', table: 'payers' }, { subject: 'id', fields: ['iban'], erasure: 'pseudonymise', retention: { after: 'left_at', days: 1 } });",
        '',
      ].join('\n'),
    );

    expectOk(cli(root, 'docs'));

    const context = read(root, CONTEXT);

    expect(context).toContain(
      '| `cards` | `holder_id` | `holder_name`; files `scan_key` | row deleted | 13 months after `expired_at` |',
    );

    expect(context).toContain('| `payers` | `id` | `iban` | pseudonymised | 1 day after `left_at` |');
    expect(context.indexOf('## Personal data')).toBeLessThan(context.indexOf('## Permissions'));
  });

  it('refuses to rewrite a register whose markers were removed, and says how to put them back', () => {
    const root = initProject();

    rewrite(root, REGISTER, (content) => content.replace(/<!-- \/?ddd-ts-kit:personal-data-register -->\n/g, ''));

    const result = cli(root, 'docs');

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('docs/privacy/register.md has no "ddd-ts-kit:personal-data-register" markers.');
  });
});
