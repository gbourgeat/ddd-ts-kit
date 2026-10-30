import { describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { jsonAt } from './support/json-at';
import { type Histories, mergeRepository, mergeWith } from './support/merge-repository';

const MANIFEST = 'package.json';
const PRICING = 'src/contexts/billing/pricing.ts';
const CHANGES = 'CHANGES.md';

/** The kinds of the findings under `key` of the first merge of `verify-merge HEAD --json`. */
function kinds(root: string, key: 'errors' | 'warnings'): string[] {
  const findings = jsonAt(cli(root, 'verify-merge', 'HEAD', '--json').json(), 'merges', '0', key);

  return Array.isArray(findings) ? findings.map((finding) => String(jsonAt(finding, 'kind'))) : [];
}

function merged(histories: Histories, resolution: Readonly<Record<string, string | null>>): string {
  const root = mergeRepository(histories);

  mergeWith(root, resolution);

  return root;
}

const manifest = (...dependencies: readonly string[]): string =>
  `{\n  "name": "invoicing",\n  "dependencies": {\n${dependencies.map((line) => `    ${line}`).join(',\n')}\n  }\n}\n`;

const pricing = (...body: readonly string[]): string =>
  ['export function priceOf(amount: Money): Money {', ...body.map((line) => `  ${line}`), '}', ''].join('\n');

describe('verify-merge, the choices of a merge that are no loss', () => {
  it('reads a line both sides changed and the merge took from one as superseded, unless the hunk lost more than what competed', () => {
    const histories = {
      base: { [MANIFEST]: manifest('"money": "1.0.0"') },
      ours: { [MANIFEST]: manifest('"money": "1.1.0"') },
      theirs: { [MANIFEST]: manifest('"money": "2.0.0"') },
    };

    const versionChosen = merged(histories, { [MANIFEST]: manifest('"money": "2.0.0"') });

    const withDependency = { ...histories, ours: { [MANIFEST]: manifest('"money": "1.1.0"', '"calendar": "1.0.0"') } };
    const dependencyDropped = merged(withDependency, { [MANIFEST]: manifest('"money": "2.0.0"') });

    expect(kinds(versionChosen, 'errors')).toEqual([]);
    expect(kinds(versionChosen, 'warnings')).toEqual(['superseded']);

    expect(cli(versionChosen, 'verify-merge', 'HEAD').stdout).toContain(
      '(from ours, where the other side changed the same lines)',
    );

    expect(kinds(dependencyDropped, 'errors')).toEqual(['lost-line', 'lost-line']);
  });

  it('reads the lines of a file the other side deleted, and those inserted in a block it deleted, as superseded', () => {
    const rounding = ['const cents = amount.cents;', 'const rounded = Math.round(cents);', 'return Money.of(rounded);'];

    const fileDeleted = merged(
      {
        base: { [PRICING]: pricing(...rounding) },
        ours: { [PRICING]: null },
        theirs: { [PRICING]: pricing(...rounding.slice(0, 2), 'audit(rounded);', ...rounding.slice(2)) },
      },
      { [PRICING]: null },
    );

    const blockDeleted = merged(
      {
        base: { [PRICING]: `export const VAT = 20;\n\n${pricing(...rounding)}` },
        ours: { [PRICING]: 'export const VAT = 20;\n' },
        theirs: {
          [PRICING]: `export const VAT = 20;\n\n${pricing(...rounding.slice(0, 2), 'audit(rounded);', ...rounding.slice(2))}`,
        },
      },
      { [PRICING]: 'export const VAT = 20;\n' },
    );

    expect(kinds(fileDeleted, 'errors')).toEqual([]);
    expect(kinds(fileDeleted, 'warnings')).toEqual(['superseded']);
    expect(kinds(blockDeleted, 'errors')).toEqual([]);
    expect(kinds(blockDeleted, 'warnings')).toContain('superseded');
  });

  it('reads a line the merge commit replaced, where it stood, by a line no side has as rewritten', () => {
    const changes = (release: string, ...entries: readonly string[]): string =>
      ['# Changes', '', release, '', ...entries.map((entry) => `- ${entry}`), ''].join('\n');

    const root = merged(
      {
        base: { [CHANGES]: changes('This release holds every fix up to 1.0.1.', 'Issue an invoice.') },
        ours: { [CHANGES]: changes('This release holds every fix up to 1.0.2.', 'Issue an invoice.') },
        theirs: {
          [CHANGES]: changes('This release holds every fix up to 1.0.1.', 'Issue an invoice.', 'Pay an invoice.'),
        },
      },
      { [CHANGES]: changes('This release holds every fix up to 1.0.3.', 'Issue an invoice.', 'Pay an invoice.') },
    );

    expect(kinds(root, 'errors')).toEqual([]);
    expect(kinds(root, 'warnings')).toEqual(['rewritten']);
  });
});

describe('verify-merge, a base line the merge dropped', () => {
  it('is lost where the side kept it, outside the lines it changed, though the side added a copy of it', () => {
    const kept = 'return Money.of(cents);';

    const histories = {
      base: { [PRICING]: pricing('const cents = amount.cents;', kept) },
      ours: { [PRICING]: pricing('const cents = amount.cents;', kept, kept) },
      theirs: { [PRICING]: pricing('const cents = amount.cents;', 'audit(cents);', kept) },
    };

    const dropped = merged(histories, { [PRICING]: pricing('const cents = amount.cents;', 'audit(cents);') });
    const errors = jsonAt(cli(dropped, 'verify-merge', 'HEAD', '--json').json(), 'merges', '0', 'errors');

    expect(Array.isArray(errors) ? errors.map((finding) => jsonAt(finding, 'line')) : []).toContain(3);
    expect(kinds(dropped, 'errors')).toContain('lost-line');
  });
});

describe('verify-merge, files it reads as one thing or not at all', () => {
  it('reports a file the merge commit deleted, that both sides kept, as one finding', () => {
    const guide = Array.from({ length: 6 }, (_, index) => `Step ${index + 1} of issuing an invoice.`).join('\n');

    const root = merged(
      {
        base: { 'docs/invoicing.md': `${guide}\n`, [PRICING]: pricing('return amount;') },
        ours: { [PRICING]: pricing('return amount.rounded();') },
        theirs: { [CHANGES]: '# Changes\n' },
      },
      { 'docs/invoicing.md': null },
    );

    expect(kinds(root, 'errors')).toEqual(['file-deleted']);

    expect(cli(root, 'verify-merge', 'HEAD').stdout).toContain(
      'files deleted by the merge:\n    docs/invoicing.md (both)  6 line(s) of it in no file of the result',
    );
  });

  it('leaves out of the lines a file a tool wrote and the lockfiles of other ecosystems', () => {
    const pins = (version: string): string =>
      `# This file is autogenerated by pip-compile with Python 3.12\nmoney==${version}\n`;

    const root = merged(
      {
        base: { 'requirements/dev.txt': pins('1.0'), 'uv.lock': 'money 1.0\n' },
        ours: { 'requirements/dev.txt': pins('1.1'), 'uv.lock': 'money 1.1\n' },
        theirs: { 'requirements/dev.txt': pins('2.0'), 'uv.lock': 'money 2.0\n' },
      },
      { 'requirements/dev.txt': pins('2.0'), 'uv.lock': 'money 2.0\n' },
    );

    expect(kinds(root, 'errors')).toEqual([]);
    expect(kinds(root, 'warnings')).toEqual([]);
  });

  it('takes no title underline, no fixture and no marker a side committed by mistake for a conflict marker', () => {
    const fixture = '<<<<<<< ours\nthe premium plan\n=======\nthe standard plan\n>>>>>>> theirs\n';

    const root = merged(
      {
        base: { 'docs/billing.rst': 'Billing\n=======\n', [CHANGES]: '# Changes\n' },
        ours: {
          'docs/billing.rst': 'Billing\n=======\n\nPayment\n=======\n',
          'test/fixtures/conflicted.txt': fixture,
          'docs/notes.md': '<<<<<<< HEAD\nInvoices are issued monthly.\n=======\n>>>>>>> main\n',
        },
        theirs: { [CHANGES]: '# Changes\n\n- Pay an invoice.\n' },
      },
      { 'docs/notes.md': 'Invoices are issued monthly.\n' },
    );

    expect(kinds(root, 'errors')).toEqual([]);
  });
});
