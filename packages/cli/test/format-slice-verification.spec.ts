import { describe, expect, it } from 'vitest';
import { summarize } from '../src/check/engine/summarize.js';
import type { Violation } from '../src/check/model/violation.js';
import { formatSliceVerification } from '../src/slice/format-slice-verification.js';
import type { SliceVerification } from '../src/slice/slice-verification.js';

const PASSED = { ok: true, output: '' };

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
      ['regenerate: ok', 'check (changed since main): ok', 'tests of billing: ok', 'next: nothing to commit'].join(
        '\n',
      ),
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
