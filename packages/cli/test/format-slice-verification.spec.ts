import { describe, expect, it } from 'vitest';
import { summarize } from '../src/check/engine/summarize.js';
import type { Violation } from '../src/check/model/violation.js';
import { formatSliceVerification } from '../src/slice/format-slice-verification.js';
import type { SliceVerification } from '../src/slice/slice-verification.js';

const PASSED = { ok: true, output: '' };

const NO_MERGE = { merges: [], errorCount: 0, warningCount: 0, ok: true };

const warning: Violation = {
  ruleId: 'clean/function-size',
  severity: 'warn',
  file: 'src/contexts/billing/domain/services/pricing.service.ts',
  line: 3,
  message: 'Function price takes 4 parameters (limit 3).',
  fix: 'Group the parameters.',
};

const verification = (overrides: Partial<SliceVerification>): SliceVerification => ({
  context: 'billing',
  since: 'main',
  regenerate: PASSED,
  check: summarize([]),
  tests: PASSED,
  merges: NO_MERGE,
  nearTheLimit: [],
  toStage: [],
  leftOut: [],
  citedRemovals: [],
  ok: true,
  ...overrides,
});

describe('the report of verify-slice', () => {
  it('says there is nothing to commit when every step passed and nothing changed', () => {
    expect(formatSliceVerification(verification({}))).toBe(
      [
        'regenerate: ok',
        'check (changed since main): ok',
        'tests of billing: ok',
        'merges since main: none',
        'next: nothing to commit',
      ].join('\n'),
    );
  });

  it('counts the warnings, shows them, and still lists the paths to stage of a passing slice', () => {
    const report = formatSliceVerification(
      verification({
        check: summarize([warning]),
        toStage: ['src/contexts/billing/domain/services/pricing.service.ts'],
      }),
    );

    expect(report).toContain('check (changed since main): ok, 1 warning(s)');
    expect(report).toContain(`    ${warning.file}:3  warn   clean/function-size`);
    expect(report).toContain('next: commit the slice, staging these paths one by one: feat(billing):');
  });

  it('says that nothing of the slice is to commit when every change is left out', () => {
    const report = formatSliceVerification(verification({ leftOut: ['src/platform/auth/relationship-schema.ts'] }));

    expect(report).toContain(
      "next: nothing of the slice of billing to commit; every change is left out below, outside the slice: a shared file is the conductor's",
    );

    expect(report).not.toContain('next: nothing to commit');
  });

  it('lists what it leaves out after the next step, whatever the result', () => {
    const report = formatSliceVerification(verification({ leftOut: ['notes.md'], ok: false }));

    expect(report.endsWith('never stage them with it (a person decides about them)\n  notes.md')).toBe(true);
  });

  it('shows the cause of a failed step and the files near the limit, then asks to run again', () => {
    const report = formatSliceVerification(
      verification({
        regenerate: { ok: false, output: 'docs:generate failed' },
        nearTheLimit: [{ file: 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts', lines: 342 }],
        ok: false,
      }),
    );

    expect(report).toContain('regenerate: failed\n    docs:generate failed');
    expect(report).toContain('  src/contexts/billing/domain/aggregates/invoice.aggregate.ts (342)');
    expect(report).toContain('next: fix the causes above, then run verify-slice again');
  });
});

describe('the report of verify-slice: the names a design cites and the merges', () => {
  it('ends with the names the slice removes that a design still cites, and what replaced them', () => {
    const report = formatSliceVerification(
      verification({
        citedRemovals: [
          {
            rows: ['M2.04'],
            document: 'docs/architecture/reviews/refunds.md',
            line: 14,
            cited: 'RefundBasisService',
            kind: 'symbol',
            state: 'removed',
            removedBy: { path: 'src/contexts/billing/domain/services/refund-basis.service.ts' },
            candidates: [
              {
                name: 'RefundBasisReader',
                file: 'src/contexts/billing/application/ports/refund-basis-reader.port.ts',
                evidence: 'added-with-removal',
              },
            ],
          },
        ],
      }),
    );

    expect(
      report.endsWith(
        '  `RefundBasisService` (now RefundBasisReader): docs/architecture/reviews/refunds.md:14 (#M2.04)',
      ),
    ).toBe(true);
  });
});

describe('the report of verify-slice, on the merges of the branch', () => {
  it('shows what a merge of the branch lost under its step without failing the slice yet, and a merge that lost nothing as ok', () => {
    const lost = {
      kind: 'lost-line',
      file: 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
      line: 40,
      side: 'ours',
      text: 'pay(amount: Money): void {',
    } as const;

    const merge = {
      commit: 'f5fdb26c0ffee',
      subject: 'Merge main into build/billing',
      base: 'f19bfe8c0ffee',
      baseFrom: 'merge-base',
      ours: 'f4a2e02c0ffee',
      theirs: '0c9930ac0ffee',
      errors: [lost],
      warnings: [],
      accepted: [],
      repaired: [],
    } as const;

    const reported = formatSliceVerification(
      verification({ merges: { since: 'main', merges: [merge], errorCount: 1, warningCount: 0, ok: false } }),
    );

    const passed = formatSliceVerification(
      verification({ merges: { merges: [{ ...merge, errors: [] }], errorCount: 0, warningCount: 0, ok: true } }),
    );

    expect(reported).toContain(
      'merges since main: 1 error(s), not failing the slice in this version\n    merge f5fdb26 "Merge main into build/billing": 1 error(s)',
    );

    expect(reported).toContain(`        ${lost.file}:40 (ours)  pay(amount: Money): void {`);

    expect(reported).toContain(
      '  restore each loss above before the commit: a later minor version fails the slice on them',
    );

    expect(reported).toContain('next: nothing to commit');
    expect(passed).toContain('merges since main: ok\n');
  });
});
