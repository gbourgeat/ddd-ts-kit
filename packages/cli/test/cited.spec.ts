import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers.js';
import { commitFiles } from './support/commit-files.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';

const BILLING = 'src/contexts/billing';
const SERVICE = `${BILLING}/domain/services/refund-basis.service.ts`;
const PORT = `${BILLING}/application/ports/refund-basis-reader.port.ts`;
const INVOICE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const REVIEW = 'docs/architecture/reviews/refunds.md';
const SLICES = 'docs/architecture/slices.md';

const SLICES_TEXT = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M2.01 | billing | slice | Draft the refund | \`generate command billing DraftRefund --public\` | | billing | done |
| M2.03 | billing | slice | Compute the refund | \`generate command billing ComputeRefund --public\` | M2.01 | billing | todo |
| M2.04 | billing | slice | Pay the refund | fill \`RefundBasisService\` | M2.03 | billing | todo |

## Rules per slice

- #M2.04: pays what \`RefundBasisReader\` reads.
`;

const REVIEW_TEXT = `# Refunds

## #M2.01 Draft the refund

Drafted from \`RefundBasisService\`.

## #M2.03 Compute the refund

Call \`RefundBasisService\` from the handler, check it with \`RefundBasisPolicy\`, stamp it with \`Clock\`.
Its old home \`application/services/refund-basis.service.ts\` stays out of the tree.
Then \`Invoice.refund\`, after \`Invoice.issue\`, before \`Invoice.settle\`.
`;

const SERVICE_TEXT =
  'export class RefundBasisService {\n  basisOf(amount: number): number {\n    return amount;\n  }\n}\n';

const PORT_TEXT =
  '/** Reads what a refund is computed from. */\nexport abstract class RefundBasisReader {\n  abstract readBasis(invoiceId: string): Promise<number>;\n\n  abstract paidOn(invoiceId: string): Promise<string>;\n}\n';

let root: string;
let portCommit: string;
let refundCommit: string;

beforeAll(() => {
  root = committedProject('refunds', '--context', 'billing:core');

  commitFiles(root, {
    message: 'feat(billing): compute the refund basis',
    files: {
      [SERVICE]: SERVICE_TEXT,
      [INVOICE]: 'export class Invoice {\n  issue(): void {}\n\n  refund(): void {}\n}\n',
    },
    at: '2026-10-01T10:00:00Z',
  });

  portCommit = commitFiles(root, {
    message: 'fix(billing): read the refund basis through a port',
    files: { [SERVICE]: null, [PORT]: PORT_TEXT },
    at: '2026-10-02T10:00:00Z',
  });

  refundCommit = commitFiles(root, {
    message: 'refactor(billing): an invoice is refunded by a credit note',
    files: { [INVOICE]: 'export class Invoice {\n  issue(): void {}\n}\n' },
    at: '2026-10-03T10:00:00Z',
  });

  write(root, SLICES, SLICES_TEXT);
  write(root, REVIEW, REVIEW_TEXT);
});

describe('cited, before a row is built', () => {
  it('reports a name the trunk removed, with the port the same commit added, and keeps planned names silent', () => {
    const report = cli(root, 'cited', 'billing', '--rows', 'M2.03', '--base', 'main', '--json');
    const citations = jsonAt(report.json(), 'citations');

    expect(report.code).toBe(0);
    expect(jsonAt(report.json(), 'counts')).toEqual({ present: 2, planned: 2 });

    expect(citations).toContainEqual({
      rows: ['M2.03'],
      document: REVIEW,
      line: 9,
      cited: 'RefundBasisService',
      kind: 'symbol',
      state: 'removed',
      removedBy: {
        commit: portCommit,
        date: '2026-10-02',
        subject: 'fix(billing): read the refund basis through a port',
        path: SERVICE,
      },
      candidates: [{ name: 'RefundBasisReader', file: PORT, evidence: 'added-with-removal' }],
    });

    expect(JSON.stringify(citations)).not.toMatch(/RefundBasisPolicy|"Clock"|Invoice\.(issue|settle)/);
  });

  it('reports a place the canonical tree refuses and a method removed from a class the trunk has', () => {
    const citations = jsonAt(cli(root, 'cited', '--rows', 'M2.03', '--base', 'main', '--json').json(), 'citations');

    expect(citations).toContainEqual(
      expect.objectContaining({
        line: 10,
        cited: 'application/services/refund-basis.service.ts',
        kind: 'path',
        state: 'refused',
        refusal: '"application/services" is not a directory of the canonical tree.',
      }),
    );

    expect(citations).toContainEqual(
      expect.objectContaining({
        line: 11,
        cited: 'Invoice.refund',
        kind: 'member',
        state: 'removed',
        removedBy: {
          commit: refundCommit,
          date: '2026-10-03',
          subject: 'refactor(billing): an invoice is refunded by a credit note',
          path: INVOICE,
        },
      }),
    );
  });

  it('never judges the design of a done row, and drops a name whose successor the same part cites', () => {
    const citations = jsonAt(cli(root, 'cited', 'billing', '--base', 'main', '--json').json(), 'citations');

    const places = (citations as { document: string; line: number }[]).map(
      ({ document, line }) => `${document}:${line}`,
    );

    expect(places).toEqual([`${REVIEW}:9`, `${REVIEW}:10`, `${REVIEW}:11`]);
  });

  it('prints each name on one line, with the commit that removed it and its successor', () => {
    const report = cli(root, 'cited', 'billing', '--rows', 'M2.03', '--base', 'main');

    expect(report.stdout).toContain(
      `Names of the design of #M2.03 that main does not have (checked at ${refundCommit}):`,
    );

    expect(report.stdout).toContain(
      `- ${REVIEW}:9 \`RefundBasisService\`: removed by ${portCommit} (2026-10-02, "fix(billing): read the refund basis through a port"); now \`RefundBasisReader\`, ${PORT} (added with the removal) (#M2.03)`,
    );

    expect(report.stdout).toContain(
      `- ${REVIEW}:10 \`application/services/refund-basis.service.ts\`: a place the canonical tree refuses:`,
    );

    expect(report.stdout).toContain('Also cited: 2 present, 2 planned (silent).');
  });

  it('says so when the design cites no stale name, and checks the current branch by default', () => {
    const report = cli(root, 'cited', 'billing', '--rows', 'M2.04');

    expect(report.code).toBe(0);

    expect(report.stdout).toBe(
      `No stale name in the design of #M2.04 on main (checked at ${refundCommit}): 1 present, 0 planned (silent).`,
    );
  });

  it('refuses a row the slices file does not have and a base that names no commit', () => {
    const row = cli(root, 'cited', '--rows', 'M9.99');
    const base = cli(root, 'cited', '--base', 'nowhere');

    expect(row.code).toBe(2);
    expect(row.stderr).toContain('Row #M9.99 is not in docs/architecture/slices.md.');
    expect(base.code).toBe(2);
    expect(base.stderr).toContain('nowhere is not a commit of this repository.');
  });
});

describe('cited --removed-since, after a change', () => {
  it('names what the change removes that the design of a row not done still cites', () => {
    fs.rmSync(path.join(root, PORT));

    const text = cli(root, 'cited', '--removed-since', 'main');
    const json = cli(root, 'cited', '--removed-since', 'main', '--json').json();

    git(root, 'checkout', '--', PORT);

    expect(text.stdout).toBe(
      [
        'Names removed since main that the design of rows not done still cites (the documents to correct):',
        `- ${SLICES}:11 \`RefundBasisReader\`: removed by this change (#M2.04)`,
      ].join('\n'),
    );

    expect(json).toMatchObject({
      since: 'main',
      citations: [{ cited: 'RefundBasisReader', removedBy: { path: PORT } }],
    });
  });

  it('says so when the change removes nothing the design cites', () => {
    expect(cli(root, 'cited', 'billing', '--removed-since', 'main').stdout).toBe(
      'No name removed since main is cited by the design of a row not done.',
    );
  });
});
