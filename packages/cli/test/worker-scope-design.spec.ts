import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli } from './helpers.js';
import { commitFiles } from './support/commit-files.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';

const BILLING = 'src/contexts/billing';
const SERVICE = `${BILLING}/domain/services/refund-basis.service.ts`;
const PORT = `${BILLING}/application/ports/refund-basis-reader.port.ts`;
const REVIEW = 'docs/architecture/reviews/refunds.md';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M2.03 | billing | slice | Compute the refund | \`generate command billing ComputeRefund --public\` | | billing | todo |
| M2.04 | billing | slice | Pay the refund | \`generate command billing PayRefund --public\` | | billing | todo |
`;

const REVIEW_TEXT = '# Refunds\n\n## #M2.03 Compute the refund\n\nCall `RefundBasisService` from the handler.\n';

let root: string;
let portCommit: string;

beforeAll(() => {
  root = committedProject('desk', '--context', 'billing:core');

  commitFiles(root, {
    message: 'feat(billing): compute the refund basis',
    files: {
      [SERVICE]: 'export class RefundBasisService {\n  basisOf(amount: number): number {\n    return amount;\n  }\n}\n',
    },
  });

  portCommit = commitFiles(root, {
    message: 'fix(billing): read the refund basis through a port',
    files: {
      [SERVICE]: null,
      [PORT]:
        '/** Reads what a refund is computed from. */\nexport abstract class RefundBasisReader {\n  abstract readBasis(invoiceId: string): Promise<number>;\n}\n',
    },
  });

  commitFiles(root, {
    message: 'docs: slices and review',
    files: { 'docs/architecture/slices.md': SLICES, [REVIEW]: REVIEW_TEXT },
  });
});

describe('worker-scope, on the design of the rows it briefs', () => {
  it('holds the names the trunk does not have, and points the slice to its design', () => {
    const scope = cli(
      root,
      'worker-scope',
      'billing',
      '--rows',
      'M2.03',
      '--base',
      'main',
      '--dry-run',
      '--json',
    ).json();

    expect(jsonAt(scope, 'citations')).toMatchObject({
      base: 'main',
      counts: { present: 0, planned: 0 },
      citations: [{ rows: ['M2.03'], document: REVIEW, line: 5, cited: 'RefundBasisService', state: 'removed' }],
    });

    expect(jsonAt(scope, 'slices')).toEqual([
      expect.objectContaining({ id: 'M2.03', design: [{ document: REVIEW, section: '#M2.03 Compute the refund' }] }),
    ]);
  });

  it('briefs the worker with the design line and the names to build on, and tells the conductor where they are', () => {
    const scope = cli(
      root,
      'worker-scope',
      'billing',
      '--rows',
      'M2.03',
      '--base',
      'main',
      '--dry-run',
      '--json',
    ).json();

    const briefing = String(jsonAt(scope, 'briefing'));

    expect(briefing).toContain(
      [
        '- #M2.03 Compute the refund: `generate command billing ComputeRefund --public`',
        `  design: ${REVIEW} (section "#M2.03 Compute the refund")`,
        'Names of the design that main does not have (checked at ',
      ].join('\n'),
    );

    expect(briefing).toContain(`- ${REVIEW}:5 \`RefundBasisService\`: removed by ${portCommit} (`);

    expect(briefing).toContain(
      'and put each line in your report as a note for the conductor, who corrects the document.',
    );

    expect(jsonAt(scope, 'notes')).toContain(
      `The design of #M2.03 cites 1 name main does not have (${REVIEW}:5): correct them on the trunk before the worker starts, or launch as is: its briefing lists them.`,
    );
  });

  it('adds nothing for a row whose design cites no stale name', () => {
    const scope = cli(
      root,
      'worker-scope',
      'billing',
      '--rows',
      'M2.04',
      '--base',
      'main',
      '--dry-run',
      '--json',
    ).json();

    expect(jsonAt(scope, 'citations')).toMatchObject({ citations: [], notes: [] });
    expect(String(jsonAt(scope, 'briefing'))).not.toContain('Names of the design');
    expect(String(jsonAt(scope, 'briefing'))).not.toContain('design:');
  });

  it('notes a local base behind its upstream: the names were checked against what it has', () => {
    const clone = path.join(path.dirname(root), 'desk-clone');

    execFileSync('git', ['clone', '--quiet', `file://${root}`, clone], { stdio: 'ignore' });
    commitFiles(root, { message: 'docs: one more line', files: { 'docs/architecture/notes.md': '# Notes\n' } });
    git(clone, 'fetch', '--quiet');

    const scope = cli(
      clone,
      'worker-scope',
      'billing',
      '--rows',
      'M2.03',
      '--base',
      'main',
      '--dry-run',
      '--json',
    ).json();

    expect(jsonAt(scope, 'notes')).toContain(
      'main is 1 commit behind origin/main: the names were checked against main; fetch and pass --base origin/main.',
    );
  });

  it('caps the names of the briefing at eight lines and points to the JSON for the rest', () => {
    const many = Array.from({ length: 10 }, (_, index) => `\`RefundBasisService\` line ${index}.`).join('\n\n');

    commitFiles(root, {
      message: 'docs: a long review',
      files: { [REVIEW]: `# Refunds\n\n## #M2.03 Compute the refund\n\n${many}\n` },
    });

    const briefing = String(
      jsonAt(
        cli(root, 'worker-scope', 'billing', '--rows', 'M2.03', '--base', 'main', '--dry-run', '--json').json(),
        'briefing',
      ),
    );

    expect(briefing.match(/^- docs\/architecture\/reviews\/refunds\.md:/gm)).toHaveLength(8);
    expect(briefing).toContain('(2 more: worker-scope --json)');
  });
});
