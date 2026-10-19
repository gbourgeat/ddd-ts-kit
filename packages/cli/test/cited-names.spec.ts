import { describe, expect, it } from 'vitest';
import { citedNames } from '../src/citations/cited-names.js';
import { textUnits } from '../src/citations/text-units.js';

const VOCABULARY = { sourceRoot: 'src', terms: new Set(['invoice']) };

function names(text: string): string[] {
  const part = {
    document: 'docs/architecture/reviews/billing.md',
    rows: ['M2.03'],
    texts: textUnits(text.split('\n'), 1),
  };

  return citedNames(part, VOCABULARY).map(
    ({ cited, kind, line, recorded }) => `${line} ${kind} ${cited}${recorded ? ' (recorded)' : ''}`,
  );
}

describe('the names a design cites', () => {
  it('reads inline code only, outside fenced blocks', () => {
    expect(
      names('# Review\n\n```ts\nconst basis = new `RefundBasisService`();\n```\n\nUse `RefundBasisReader` here.'),
    ).toEqual(['7 symbol RefundBasisReader']);
  });

  it('leaves out a line number, a call and type arguments', () => {
    expect(
      names(
        'See `src/contexts/billing/domain/aggregates/invoice.aggregate.ts:42`, `Invoice.refund()` and `Page<CreditNote>`.',
      ),
    ).toEqual([
      '1 path src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
      '1 member Invoice.refund',
      '1 symbol Page',
    ]);
  });

  it('skips a generator command, a term of the glossary, codes, permissions and camelCase words', () => {
    expect(
      names(
        '`generate command billing RefundInvoice --aggregate Invoice`, `Invoice`, `Ledger`, `SLOT_TAKEN`, `invoice.refund`, `refundBasis`',
      ),
    ).toEqual(['1 symbol Ledger']);
  });

  it('reads full paths, paths relative to a context, platform paths and directories, never placeholders or documents', () => {
    expect(
      names(
        [
          '`src/contexts/billing/application/ports/refund-basis-reader.port.ts`, `application/services/refund-basis.service.ts`,',
          '`src/platform/auth/roles/roles.ts`, `application/ports/`, `docs/architecture/slices.md`, `test/e2e/refund.e2e.spec.ts`,',
          '`application/projections/<name>.projection.ts`, `CONTEXT.md`, `README.md`',
        ].join('\n'),
      ),
    ).toEqual([
      '1 path src/contexts/billing/application/ports/refund-basis-reader.port.ts',
      '1 path application/services/refund-basis.service.ts',
      '2 path src/platform/auth/roles/roles.ts',
      '2 path application/ports/',
    ]);
  });

  it('reads Class.member, and numbers the line of a name inside a paragraph', () => {
    expect(names('The slot is found\nby `Calendar.slotFor` first.')).toEqual(['2 member Calendar.slotFor']);
  });

  it('marks a name whose sentence records its removal or its rename, never one a code span only mentions', () => {
    expect(
      names(
        '`RefundBasisService` is removed: read through the port. Then `RefundBasisReader` reads it.\n\n`.member-removed` events reach `MemberDirectory`.',
      ),
    ).toEqual(['1 symbol RefundBasisService (recorded)', '1 symbol RefundBasisReader', '3 symbol MemberDirectory']);
  });

  it('keeps a table row and a heading as pieces of their own', () => {
    expect(textUnits(['## `Heading`', '| `A` |', '| `B` |', '- item', '  more', 'text', '', 'next'], 10)).toEqual([
      { line: 10, text: '## `Heading`' },
      { line: 11, text: '| `A` |' },
      { line: 12, text: '| `B` |' },
      { line: 13, text: '- item\n  more\ntext' },
      { line: 17, text: 'next' },
    ]);
  });
});
