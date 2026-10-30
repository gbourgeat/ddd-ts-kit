import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { personalEventLines } from '../src/docs/personal-event-lines';
import { cli, exists, read } from './helpers';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const LIST = 'src/platform/privacy/personal-events.ts';
const EVENT = 'src/contexts/billing/published-language/invoice-issued.v1.integration-event.ts';

/** Declares the email of the customer as the personal data of a new event of billing. */
function withPersonalEvent(root: string): void {
  expectOk(
    cli(root, 'generate', 'integration-event', 'billing', 'Invoice', 'Issued', '--term', 'Issued=Sent for payment'),
  );

  writeFileSync(
    path.join(root, EVENT),
    read(root, EVENT).replace(
      '  version: 1,\n',
      "  version: 1,\n  personal: { subject: 'invoiceId', fields: ['customerEmail'] },\n",
    ),
  );
}

describe('docs: the list of the events that carry personal data', () => {
  it('is written by init, empty, beside the register', () => {
    const list = read(initProject(), LIST);

    expect(list).toContain('export const personalEvents: readonly PersonalEvent[] = [');
    expect(list).toContain('  // ddd-ts-kit:personal-events\n  // /ddd-ts-kit:personal-events\n');
  });

  it('follows the personal option of each event, and docs --check reports a list left behind', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    withPersonalEvent(root);

    expect(cli(root, 'docs', '--check').code).toBe(1);
    expectOk(cli(root, 'docs'));

    expect(read(root, LIST)).toContain(
      [
        '  {',
        "    type: 'billing.invoice.issued',",
        '    version: 1,',
        '    personal: {',
        "      subject: 'invoiceId',",
        "      fields: ['customerEmail'],",
        '    },',
        '  },',
      ].join('\n'),
    );

    expectOk(cli(root, 'docs', '--check'));
  });

  it('is not written without an outbox to reach, nor with --privacy off', () => {
    const direct = initProject('--events', 'in-memory', '--allow-no-outbox', 'One process, one database.');

    expectOk(cli(direct, 'docs'));
    expect(exists(direct, LIST)).toBe(false);

    const off = initProject('--privacy', 'off');

    expectOk(cli(off, 'docs'));
    expect(exists(off, LIST)).toBe(false);
  });

  it('comes back for a project that has none yet', () => {
    const root = initProject();

    rmSync(path.join(root, LIST));
    expectOk(cli(root, 'docs'));

    expect(read(root, LIST)).toContain('// ddd-ts-kit:personal-events');
  });

  it('says where its markers belong when they are gone', () => {
    const root = initProject();

    writeFileSync(path.join(root, LIST), 'export const personalEvents = [];\n');

    const refused = cli(root, 'docs');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(`${LIST} has no "ddd-ts-kit:personal-events" markers.`);
  });
});

describe('personalEventLines', () => {
  it('sorts the events and leaves out those that declare nothing', () => {
    const lines = personalEventLines([
      {
        publishedEvents: [
          { type: 'billing.invoice.voided', version: 1 },
          { type: 'billing.invoice.issued', version: 2, personal: { subject: 'id', fields: ['email'] } },
          { type: 'billing.invoice.issued', version: 1, personal: { subject: 'id', fields: ['email'] } },
        ],
      },
    ]);

    expect(lines.filter((line) => line.includes('version'))).toEqual(['  version: 1,', '  version: 2,']);
    expect(lines.join('\n')).not.toContain('voided');
  });

  it('lays out one field per line once they pass the width of the formatter', () => {
    const fields = Array.from({ length: 12 }, (_, index) => `personalFieldNumber${String(index)}`);

    const lines = personalEventLines([
      { publishedEvents: [{ type: 'billing.invoice.issued', version: 1, personal: { subject: 'id', fields } }] },
    ]);

    expect(lines).toContain('    fields: [');
    expect(lines).toContain("      'personalFieldNumber11',");
    expect(lines).toContain('    ],');
  });
});
