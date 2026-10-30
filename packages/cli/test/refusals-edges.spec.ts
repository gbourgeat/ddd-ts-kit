import { describe, expect, it } from 'vitest';
import { conceptImports } from '../src/refusals/concept-imports';
import { conceptNamed } from '../src/refusals/concept-named';
import { legacyMove } from '../src/refusals/legacy-move';
import type { NamedMove } from '../src/refusals/named-move';
import { ownFactory } from '../src/refusals/own-factory';
import { rewriteConceptUsages } from '../src/refusals/rewrite-concept-usages';
import { rewriteNamedUsages } from '../src/refusals/rewrite-named-usages';
import { rewriteUsages } from '../src/refusals/rewrite-usages';

const move = (overrides: Partial<NamedMove> = {}): NamedMove => ({
  context: 'scheduling',
  from: 'SlotError.taken',
  oldClass: 'SlotError',
  oldFactory: 'taken',
  oldFile: 'src/contexts/scheduling/domain/errors/slot.error.ts',
  oldPath: 'scheduling/domain/errors/slot.error',
  className: 'SlotTaken',
  classFile: 'slot-taken.error',
  factory: 'of',
  code: 'SLOT_TAKEN',
  text: '',
  imports: [],
  ...overrides,
});

/** A file that still names its concept class as a type, which no rewrite can replace. */
const LEFT = 'const left: SlotError = SlotError.taken();\n';

describe('the rewriting of the usages of a refusal, on code written otherwise than the generator writes it', () => {
  it('keeps an import whose specifier is not a string literal', () => {
    const concept = 'import { SlotError } from SOMEWHERE;\nconst x = SlotTaken.of();\n';
    const legacy = 'import { SlotTakenError } from SOMEWHERE;\n';

    expect(conceptImports(concept, 'SlotError', [move()])).toBe(concept);

    expect(rewriteUsages(legacy, [legacyMove(move({ oldFactory: undefined, oldClass: 'SlotTakenError' }))])).toContain(
      'from SOMEWHERE;',
    );
  });

  it('names a class per error after the longest aggregate its words start or end with', () => {
    expect(conceptNamed('InvoiceLineError', ['Invoice', 'InvoiceLine'])).toBe('InvoiceLine');
  });

  it('keeps a factory that builds no refusal as written', () => {
    const factory = {
      name: 'taken',
      parameter: undefined,
      code: undefined,
      start: 0,
      end: 0,
      text: '  static taken() {\n    return 1;\n  }',
    };

    expect(ownFactory(factory, { oldClass: 'SlotError', className: 'SlotTaken', factory: 'of' })).toBe(factory.text);
  });

  it('replaces the factory of a concept class that is gone, and leaves what still names it, told to nobody by default', () => {
    const applied = { moves: [move()], gone: new Set(['SlotError']) };

    expect(rewriteConceptUsages(LEFT, applied)).toBe('const left: SlotError = SlotTaken.of();\n');
    expect(rewriteNamedUsages(LEFT, applied)).toBe('const left: SlotError = SlotTaken.of();\n');
  });
});
