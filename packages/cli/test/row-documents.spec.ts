import { describe, expect, it } from 'vitest';
import { mentionedRows } from '../src/citations/mentioned-rows';
import { partsOfDocument } from '../src/citations/parts-of-document';
import { partsOfSlices } from '../src/citations/parts-of-slices';
import { rowDocuments } from '../src/citations/row-documents';
import { selectParts } from '../src/citations/select-parts';
import type { DocumentPart } from '../src/citations/document-part';
import type { Slice } from '../src/progress/slice';
import { tempDir, write } from './helpers';

const REVIEW = `# Refunds

The intro cites \`RefundBasisReader\`.

## #M2.03 Compute the refund

Use \`RefundBasisService\`.

### Details

\`RefundBasisPolicy\`

## #M2.04 Pay the refund

\`CreditNote\`
`;

const row = (id: string, status: string): Slice => ({
  id,
  context: 'billing',
  kind: 'slice',
  slice: `Row ${id}`,
  startWith: '',
  dependsOn: [],
  owner: 'billing',
  status,
});

function shape(parts: readonly DocumentPart[]): string[] {
  return parts.map(
    (part) =>
      `${part.document}|${part.section ?? ''}|${part.rows.join(',')}|${part.texts.map((text) => text.line).join(',')}`,
  );
}

describe('the parts of a design document', () => {
  it('gives a row named in a heading its section, and the rest of the document to no row', () => {
    expect(shape(partsOfDocument({ path: 'r.md', text: REVIEW }, ['M2.03', 'M2.04'], []))).toEqual([
      'r.md|#M2.03 Compute the refund|M2.03|5,7,9,11',
      'r.md|#M2.04 Pay the refund|M2.04|13,15',
      'r.md|||1,3',
    ]);
  });

  it('gives a row named in the text, or linked by its rule line, the whole document', () => {
    const text = '# Notes\n\nFor M2.03, read `RefundBasisReader`.\n';

    expect(shape(partsOfDocument({ path: 'n.md', text }, ['M2.03', 'M2.05'], ['M2.05']))).toEqual([
      'n.md||M2.03,M2.05|1,3',
    ]);
  });

  it('matches ids word-bounded, and a bare number only with its #', () => {
    expect(mentionedRows('rows M1.35 and 14.15', ['M1.3', 'M1.35', '4.15'])).toEqual(['M1.35']);
    expect(mentionedRows('12 invoices, see #12.', ['12'])).toEqual(['12']);
    expect(mentionedRows('12 invoices', ['12'])).toEqual([]);
  });

  it('reads the cells and rule lines of a row in the slices file, and the documents its rule line links to', () => {
    const slices = [
      '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |',
      '|---|---|---|---|---|---|---|---|',
      '| M2.03 | billing | slice | Compute the refund | fill `RefundBasisService` | | billing | todo |',
      '',
      '- #M2.03: see [the review](reviews/refunds.md#m203) and `docs/architecture/reviews/billing.md`.',
      '- M9.99: a rule no row asks for',
    ].join('\n');

    const { parts, links } = partsOfSlices(slices, ['M2.03']);

    expect(parts).toEqual([
      {
        document: 'docs/architecture/slices.md',
        rows: ['M2.03'],
        texts: [
          { line: 3, text: 'Compute the refund' },
          { line: 3, text: 'fill `RefundBasisService`' },
          { line: 5, text: 'see [the review](reviews/refunds.md#m203) and `docs/architecture/reviews/billing.md`.' },
        ],
      },
    ]);

    expect([...links]).toEqual([
      ['docs/architecture/reviews/refunds.md', ['M2.03']],
      ['docs/architecture/reviews/billing.md', ['M2.03']],
    ]);
  });
});

describe('the design documents of a project', () => {
  it('leaves out a translation next to its original, the documents before the bootstrap and the slices file', () => {
    const root = tempDir('row-documents');

    write(
      root,
      'docs/architecture/slices.md',
      '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n',
    );

    write(root, 'docs/architecture/reviews/refunds.md', '# #M2.03\n');
    write(root, 'docs/architecture/reviews/refunds.fr.md', '# #M2.03\n');
    write(root, 'docs/architecture/reviews/alone.fr.md', '# #M2.03\n');
    write(root, 'docs/architecture/before-bootstrap/glossary.md', '# #M2.03\n');

    expect(rowDocuments(root, [row('M2.03', 'todo')]).map((part) => part.document)).toEqual([
      'docs/architecture/reviews/alone.fr.md',
      'docs/architecture/reviews/alone.fr.md',
      'docs/architecture/reviews/refunds.md',
      'docs/architecture/reviews/refunds.md',
    ]);
  });

  it('selects the parts of the rows asked for only, those of no row on demand', () => {
    const parts: DocumentPart[] = [
      { document: 'a.md', rows: ['M2.01'], texts: [] },
      { document: 'b.md', rows: ['M2.01', 'M2.03'], texts: [] },
      { document: 'c.md', rows: [], texts: [] },
    ];

    expect(shape(selectParts(parts, { rows: new Set(['M2.03']), unlinked: false }))).toEqual(['b.md||M2.03|']);

    expect(shape(selectParts(parts, { rows: new Set(['M2.03']), unlinked: true }))).toEqual([
      'b.md||M2.03|',
      'c.md|||',
    ]);
  });
});
