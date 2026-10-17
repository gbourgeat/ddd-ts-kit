import { describe, expect, it } from 'vitest';
import { cli } from './helpers.js';
import { git } from './support/git.js';
import {
  BOTH_KEPT,
  CANCEL,
  INVOICE,
  invoice,
  PAY,
  PAY_AND_CANCEL,
  ROUTES,
  SLICES,
  slices,
  SPEC,
} from './support/invoicing-merge.js';
import { jsonAt } from './support/json-at.js';
import { mergeRepository, mergeWith, startMerge } from './support/merge-repository.js';

const MODULE = 'src/contexts/billing/pricing.ts';

/** The kinds of the findings under `key` of the first merge of a JSON answer, in order. */
function kinds(answer: unknown, key: 'errors' | 'warnings' | 'accepted' | 'repaired' = 'errors'): string[] {
  const findings = jsonAt(answer, 'merges', '0', key);

  return Array.isArray(findings) ? findings.map((finding) => String(jsonAt(finding, 'kind'))) : [];
}

describe('verify-merge, the lines of a merge', () => {
  it('reports the row a merge taking the trunk side (-X theirs) erased: 6 lines in 3 files, the row no longer done, the test lost', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    git(root, 'merge', '--quiet', '-X', 'theirs', 'main', '--message', 'Merge main into build/billing');

    const text = cli(root, 'verify-merge', 'HEAD');
    const answer = cli(root, 'verify-merge', 'HEAD', '--json').json();

    expect(text.code).toBe(1);
    expect(kinds(answer)).toEqual([...Array<string>(6).fill('lost-line'), 'row-not-done', 'test-lost']);
    expect(text.stdout).toContain('8 error(s)');
    expect(text.stdout).toContain(`${INVOICE}:8 (ours)  pay(amount: Money, at: Date): void {`);
    expect(text.stdout).toContain(`${ROUTES}:4 (ours)  payInvoiceRoute,`);
    expect(text.stdout).toContain(`rows no longer done:\n    ${SLICES}:4 (ours)  #US1.02 Pay invoice`);
    expect(text.stdout).toContain(`tests lost:\n    ${SPEC}:6 (ours)  pays an issued invoice`);
    expect(text.stdout).toContain('(git merge-base)');
    expect(text.stdout).toContain('never take one side of a whole file');
  });

  it('finds nothing in a resolution that keeps both sides', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    mergeWith(root, BOTH_KEPT);

    const result = cli(root, 'verify-merge', 'HEAD');

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^merge [0-9a-f]{7} "Merge main into build\/billing": ok$/);
  });

  it('reads a line laid out again on several lines, and a method moved to a new untracked file, as kept, in a merge in progress', () => {
    const root = mergeRepository(PAY_AND_CANCEL);
    const reflowed = PAY.join('\n').replace(') throw InvoiceError', ')\n      throw InvoiceError');

    startMerge(root, {
      ...BOTH_KEPT,
      [INVOICE]: invoice(CANCEL),
      'src/contexts/billing/invoice-payment.ts': `export class InvoicePayment {\n${reflowed}\n}\n`,
    });

    const result = cli(root, 'verify-merge', '--json');

    expect(result.code).toBe(0);
    expect(jsonAt(result.json(), 'merges', '0', 'commit')).toBeUndefined();
    expect(kinds(result.json())).toEqual([]);
    expect(kinds(result.json(), 'warnings')).toEqual([]);
  });

  it('counts an import both sides added once, and imports from one module merged into one statement as the same bindings', () => {
    const base = "import { amountOf } from './amount';\n\nexport const pricing = [amountOf];\n";

    const root = mergeRepository({
      base: { [MODULE]: base },
      ours: { [MODULE]: `import { Clock } from '@kit/time';\nimport { Money } from '@kit/money';\n${base}` },
      theirs: { [MODULE]: `import { Clock } from '@kit/time';\nimport { Currency } from '@kit/money';\n${base}` },
    });

    mergeWith(root, {
      [MODULE]: `import { Clock } from '@kit/time';\nimport {\n  Currency,\n  Money,\n} from '@kit/money';\n${base}`,
    });

    expect(cli(root, 'verify-merge', 'HEAD').code).toBe(0);
  });

  it("keeps a removal one side made, and reports a whole file taken from the trunk: the branch's lines lost, what it removed brought back", () => {
    const legacy = ['  legacy(): number {', '    return oldTotal();', '  }'];
    const onBranch = ['  total(): number {', '    return this.lines.sum();', '  }'];
    const onTrunk = ['  due(): Date {', '    return this.issuedAt.plusDays(30);', '  }'];

    const kept = ['  isDue(): boolean {', "    return this.status === 'issued';", '  }'];

    const histories = {
      base: { [INVOICE]: invoice(legacy, kept) },
      ours: { [INVOICE]: invoice(kept, onBranch) },
      theirs: { [INVOICE]: invoice(legacy, kept, onTrunk) },
    };

    const resolved = mergeRepository(histories);
    const takenFromTheTrunk = mergeRepository(histories);

    mergeWith(resolved, { [INVOICE]: invoice(kept, onBranch, onTrunk) });
    startMerge(takenFromTheTrunk, {});
    git(takenFromTheTrunk, 'checkout', '--theirs', INVOICE);
    git(takenFromTheTrunk, 'commit', '--quiet', '--all', '--no-edit');

    const answer = cli(takenFromTheTrunk, 'verify-merge', 'HEAD', '--json').json();

    expect(cli(resolved, 'verify-merge', 'HEAD').code).toBe(0);
    expect(jsonAt(answer, 'ok')).toBe(false);
    expect(kinds(answer)).toEqual(['lost-line', 'lost-line']);
    expect(kinds(answer, 'warnings')).toEqual(['revived', 'revived']);

    expect(cli(takenFromTheTrunk, 'verify-merge', 'HEAD').stdout).toContain(
      `${INVOICE}:8 (brought back, removed by ours)  legacy(): number {`,
    );
  });
});

describe('verify-merge, warnings and what it leaves out', () => {
  it('reports a line both sides changed and the merge wrote again as a warning, not an error', () => {
    const priced = (call: string): string => `export function priceOf(amount: Money): Money {\n  return ${call};\n}\n`;

    const root = mergeRepository({
      base: { [MODULE]: priced('price(amount)') },
      ours: { [MODULE]: priced('price(amount, currency)') },
      theirs: { [MODULE]: priced('price(amount, rounding)') },
    });

    mergeWith(root, { [MODULE]: priced('price(amount, currency, rounding)') });

    const result = cli(root, 'verify-merge', 'HEAD', '--json');

    expect(result.code).toBe(0);
    expect(kinds(result.json(), 'warnings')).toEqual(['rewritten', 'rewritten']);

    expect(cli(root, 'verify-merge', 'HEAD').stdout).toContain(
      '(rewritten by the merge, from ours)  return price(amount, currency);',
    );
  });

  it('with --warn, prints the same findings, says they block in a later version, and exits 0', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    git(root, 'merge', '--quiet', '-X', 'theirs', 'main', '--message', 'Merge main into build/billing');

    const blocking = cli(root, 'verify-merge', 'HEAD');
    const warned = cli(root, 'verify-merge', 'HEAD', '--warn');

    expect(blocking.code).toBe(1);
    expect(warned.code).toBe(0);
    expect(warned.stdout.startsWith(blocking.stdout)).toBe(true);
    expect(warned.stdout).toMatch(/\nwarning only \(--warn\): these errors do not block yet, a later minor version/);
    expect(cli(root, 'verify-merge', 'HEAD', '--warn', '--json').json()).toMatchObject({ ok: false, errorCount: 8 });
  });

  it('is silent and exits 0 without a merge to check', () => {
    const root = mergeRepository(PAY_AND_CANCEL);
    const result = cli(root, 'verify-merge', '--since', 'main');

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');

    expect(cli(root, 'verify-merge', '--json').json()).toEqual({
      merges: [],
      errorCount: 0,
      warningCount: 0,
      ok: true,
    });
  });

  it('keeps the slices file, the derived files and the lockfile out of the lines it compares', () => {
    const root = mergeRepository({
      base: { 'openapi/openapi.yaml': 'paths:\n', 'package-lock.json': '{}\n', [SLICES]: slices('todo', 'todo') },
      ours: { 'openapi/openapi.yaml': 'paths:\n  /invoices/{id}/payment: pay\n', 'package-lock.json': '{ "a": 1 }\n' },
      theirs: {
        'openapi/openapi.yaml': 'paths:\n  /invoices/{id}/cancellation: cancel\n',
        [SLICES]: slices('todo', 'done'),
      },
    });

    git(root, 'merge', '--quiet', '-X', 'theirs', 'main', '--message', 'Merge main into build/billing');

    expect(cli(root, 'verify-merge', 'HEAD').stdout).toMatch(/: ok$/);
  });
});
