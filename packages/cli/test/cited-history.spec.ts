import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { commitFiles } from './support/commit-files';
import { committedProject } from './support/committed-project';
import { jsonAt } from './support/json-at';

const BILLING = 'src/contexts/billing';
const REGISTER = `${BILLING}/application/ports/payment-register.port.ts`;
const LEDGER = `${BILLING}/application/ports/payment-ledger.port.ts`;
const CREDIT_NOTES = `${BILLING}/application/ports/credit-note-reader.port.ts`;

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M3.01 | billing | slice | Record a payment | fill \`PaymentRegister\` behind \`application/ports/payment-register.port.ts\` | | billing | todo |
| M3.02 | billing | slice | Issue a credit note | fill \`CreditNoteService\`, guarded by \`CreditNotePolicy\` | | billing | todo |
| M3.03 | billing | slice | Count issued invoices | write \`InvoiceIssuedProjection\` | | billing | todo |
`;

const port = (name: string): string =>
  `/** Where the payments of an invoice are recorded. */\nexport abstract class ${name} {\n  abstract record(invoiceId: string, amount: number): Promise<void>;\n\n  abstract paidFor(invoiceId: string): Promise<number>;\n\n  abstract refundedFor(invoiceId: string): Promise<number>;\n}\n`;

let root: string;

beforeAll(() => {
  root = committedProject('payments', '--context', 'billing:core');

  commitFiles(root, {
    message: 'feat(billing): record payments',
    files: { [REGISTER]: port('PaymentRegister') },
    at: '2026-09-20T10:00:00Z',
  });

  commitFiles(root, {
    message: 'refactor(billing): payments are kept in a ledger',
    files: { [REGISTER]: null, [LEDGER]: port('PaymentLedger') },
    at: '2026-09-21T10:00:00Z',
  });

  commitFiles(root, {
    message: 'docs: slices',
    files: { 'docs/architecture/slices.md': SLICES },
    at: '2026-10-01T10:00:00Z',
  });

  commitFiles(root, {
    message: 'feat(billing): credit notes and issued invoices',
    files: {
      [CREDIT_NOTES]:
        'export abstract class CreditNoteReader {\n  abstract creditOf(invoiceId: string): Promise<number>;\n}\n',
      [`${BILLING}/domain/aggregates/invoice.aggregate.ts`]: 'export class Invoice {}\n',
      [`${BILLING}/domain/events/invoice-issued.event.ts`]: 'export class InvoiceIssued {}\n',
    },
    at: '2026-10-05T10:00:00Z',
  });
});

describe('cited, on what the history of the trunk says', () => {
  it('offers the file a renamed name and a renamed path went to', () => {
    const citations = jsonAt(cli(root, 'cited', '--rows', 'M3.01', '--base', 'main', '--json').json(), 'citations');

    expect(citations).toEqual([
      expect.objectContaining({
        cited: 'PaymentRegister',
        state: 'removed',
        candidates: [{ name: 'PaymentLedger', file: LEDGER, evidence: 'renamed' }],
      }),
      expect.objectContaining({
        cited: 'application/ports/payment-register.port.ts',
        kind: 'path',
        state: 'removed',
        candidates: [{ name: LEDGER, file: LEDGER, evidence: 'renamed' }],
      }),
    ]);
  });

  it('calls similar a name never on the trunk when a close one of the same part arrived after the line was written', () => {
    const report = cli(root, 'cited', '--rows', 'M3.02', '--base', 'main');
    const citations = jsonAt(cli(root, 'cited', '--rows', 'M3.02', '--base', 'main', '--json').json(), 'citations');

    expect(citations).toEqual([
      expect.objectContaining({
        cited: 'CreditNoteService',
        state: 'similar',
        candidates: [{ name: 'CreditNoteReader', file: CREDIT_NOTES, evidence: 'same-stem' }],
      }),
    ]);

    expect(report.stdout).toContain(
      '`CreditNoteService`: not on main and never was; main has `CreditNoteReader` (port): build on it if the design means it',
    );
  });

  it('keeps silent a line written after the close name, and a name whose stem is an aggregate or an event', () => {
    write(
      root,
      'docs/architecture/reviews/credit-notes.md',
      '# Credit notes\n\n## #M3.02 Issue a credit note\n\nAsk `CreditNoteService`.\n',
    );

    const citations = jsonAt(
      cli(root, 'cited', '--rows', 'M3.02,M3.03', '--base', 'main', '--json').json(),
      'citations',
    );

    expect(
      (citations as { document: string; cited: string }[]).map(({ document, cited }) => `${document} ${cited}`),
    ).toEqual(['docs/architecture/slices.md CreditNoteService']);
  });

  it('notes a shallow history, where a removed name cannot be told from a planned one', () => {
    const shallow = path.join(path.dirname(root), 'shallow');

    execFileSync('git', ['clone', '--quiet', '--depth', '1', `file://${root}`, shallow], { stdio: 'ignore' });

    const report = cli(shallow, 'cited', '--rows', 'M3.01', '--base', 'main', '--json').json();

    expect(jsonAt(report, 'citations')).toEqual([]);

    expect(jsonAt(report, 'notes')).toEqual([
      'history is shallow: a removed name cannot be told from a planned one (`git fetch --unshallow` reads it whole).',
    ]);
  });
});
