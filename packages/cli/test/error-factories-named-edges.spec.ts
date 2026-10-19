import { describe, expect, it } from 'vitest';
import { cutFactories } from '../src/refusals/cut-factories.js';
import { importsUsedBy } from '../src/refusals/imports-used-by.js';
import type { NamedMove } from '../src/refusals/named-move.js';
import { ownFactory } from '../src/refusals/own-factory.js';
import { planTarget } from '../src/refusals/plan-target.js';
import { readConceptError } from '../src/refusals/read-concept-error.js';
import { rewriteConceptUsages } from '../src/refusals/rewrite-concept-usages.js';
import { splitConceptSpec } from '../src/refusals/split-concept-spec.js';
import { withCodes } from '../src/refusals/with-codes.js';
import fs from 'node:fs';
import path from 'node:path';
import { cli, read, tempDir, write } from './helpers.js';

const ORIGIN = { file: 'src/contexts/scheduling/domain/errors/slot.error.ts', context: 'scheduling' };

const concept = (...factories: string[]): string =>
  `import { ConceptError } from '@ddd-ts-kit/kernel';\nimport type { Slot } from './slot';\n\nexport class SlotError extends ConceptError {\n${factories.join('\n\n')}\n}\n`;

const TAKEN =
  "  static taken(slot: Slot) {\n    return SlotError.refusal('SLOT_TAKEN', 'Taken.', { at: slot.at });\n  }";

const GONE = "  static gone() {\n    return this.refusal('SLOT_GONE', 'Gone.');\n  }";

const move = (oldFactory: string, className: string, code: string): NamedMove => ({
  context: 'scheduling',
  from: `SlotError.${oldFactory}`,
  oldClass: 'SlotError',
  oldFactory,
  oldFile: ORIGIN.file,
  oldPath: 'scheduling/domain/errors/slot.error',
  className,
  classFile: className === 'SlotTaken' ? 'slot-taken.error' : 'slot-gone.error',
  factory: 'forSlot',
  code,
  text: '',
  imports: [],
});

const MOVES = [move('taken', 'SlotTaken', 'SLOT_TAKEN'), move('gone', 'SlotGone', 'SLOT_GONE')];

describe('reading a concept class', () => {
  it('reads each factory with its code, and says the one that cannot move alone', () => {
    const read = readConceptError(
      concept(
        TAKEN,
        GONE,
        "  static either(late: boolean) {\n    return late ? SlotError.refusal('LATE', 'Late.') : SlotError.refusal('EARLY', 'Early.');\n  }",
        '  static coded(code: string) {\n    return SlotError.refusal(code, "Coded.");\n  }',
        "  static other() {\n    return OtherError.refusal('OTHER', 'Other.');\n  }",
      ),
      ORIGIN,
    );

    expect(read?.factories.map(({ name, code, manual }) => [name, code, manual])).toEqual([
      ['taken', 'SLOT_TAKEN', undefined],
      ['gone', 'SLOT_GONE', undefined],
      ['either', undefined, 'it does not build exactly one refusal with refusal(..)'],
      ['coded', undefined, 'its code is not one string literal followed by a message'],
      ['other', undefined, 'it builds the refusal of OtherError, not of its own class'],
    ]);

    expect(readConceptError('export class SlotTakenError extends DomainError {}\n', ORIGIN)).toBeUndefined();
  });

  it('turns a factory into the factory of a class of its own, `this` kept, the code dropped', () => {
    const [taken, gone] = readConceptError(concept(TAKEN, GONE), ORIGIN)?.factories ?? [];
    const target = { oldClass: 'SlotError', className: 'SlotGone', factory: 'forSlot' };

    expect(gone === undefined ? '' : ownFactory(gone, target)).toBe(
      "  static forSlot() {\n    return this.refusal('Gone.');\n  }",
    );

    expect(taken === undefined ? '' : ownFactory(taken, { ...target, className: 'SlotTaken' })).toContain(
      "return SlotTaken.refusal('Taken.', { at: slot.at });",
    );
  });

  it('cuts the factories that moved, with the imports only they read, and answers nothing when the class is left empty', () => {
    const source = concept(TAKEN, GONE);
    const [taken, gone] = readConceptError(source, ORIGIN)?.factories ?? [];

    expect(cutFactories(source, 'SlotError', taken === undefined ? [] : [taken])).toBe(
      `import { ConceptError } from '@ddd-ts-kit/kernel';\n\nexport class SlotError extends ConceptError {\n${GONE}\n}\n`,
    );

    expect(
      cutFactories(
        source,
        'SlotError',
        [taken, gone].flatMap((factory) => factory ?? []),
      ),
    ).toBeUndefined();
  });
});

describe('the pieces of the move to the named form', () => {
  it('appends to the code list of a context, and refuses a key given another code', () => {
    const list = "export const SchedulingCodes = {\n  SlotTaken: 'SLOT_TAKEN'\n} as const;\n";

    expect(withCodes(list, 'scheduling', [{ key: 'SlotGone', code: 'SLOT_GONE' }])).toBe(
      "export const SchedulingCodes = {\n  SlotTaken: 'SLOT_TAKEN',\n  SlotGone: 'SLOT_GONE',\n} as const;\n",
    );

    expect(() => withCodes(list, 'scheduling', [{ key: 'SlotTaken', code: 'TAKEN' }])).toThrow(
      'SchedulingCodes.SlotTaken is already the code SLOT_TAKEN, the plan gives it TAKEN.',
    );

    expect(() => withCodes('export const CODES = [];\n', 'scheduling', [])).toThrow('are not written as');
  });

  it('keeps of the imports the names a text reads', () => {
    const imports = [
      "import { a, type B, c as d } from './x';\n",
      "import * as z from './z';\n",
      "import './side-effect';\n",
      "import e from './e';\n",
    ];

    expect(importsUsedBy(imports, 'a(z); const v: B = d; // e')).toEqual([
      "import { a, type B, c as d } from './x';\n",
      "import * as z from './z';\n",
    ]);

    expect(importsUsedBy(imports, 'a();')).toEqual(["import { a } from './x';\n"]);
  });

  it('cuts a spec of cases only, and leaves a case that builds the refusals of two classes', () => {
    const cases = [
      "  it('a', () => SlotError.taken(slot));",
      "  it('b', () => [SlotError.taken(slot), SlotError.gone()]);",
      "  it('c', () => SlotError.gone());",
    ];

    const split = splitConceptSpec(
      `import { it } from 'vitest';\n\ndescribe('SlotError', () => {\n${cases.join('\n\n')}\n});\n`,
      MOVES,
    );

    expect([...(split?.cases ?? [])]).toEqual([
      ['SlotTaken', [cases[0]]],
      ['SlotGone', [cases[2]]],
    ]);

    expect(split?.rest).toContain(`describe('SlotError', () => {\n${cases[1] ?? ''}\n});`);

    expect(
      splitConceptSpec(
        "describe('SlotError', () => {\n  const slot = aSlot();\n\n" + `${cases[0] ?? ''}\n});\n`,
        MOVES,
      ),
    ).toBeUndefined();

    expect(
      splitConceptSpec(`const slot = aSlot();\n\ndescribe('SlotError', () => {\n${cases[0] ?? ''}\n});\n`, MOVES),
    ).toBeUndefined();
  });

  it('narrows to a class by the code given, rewrites a RefusalOf of one code, and leaves a code no move has', () => {
    const source = [
      "type T = RefusalOf<typeof SlotError, 'SLOT_TAKEN'>;",
      "const a = SlotError.is(error, 'SLOT_GONE');",
      "const b = SlotError.is(error, 'OTHER');",
      '',
    ].join('\n');

    expect(rewriteConceptUsages(source, { moves: MOVES, gone: new Set() })).toBe(
      [
        'type T = RefusalOf<typeof SlotTaken>;',
        'const a = SlotGone.is(error);',
        "const b = SlotError.is(error, 'OTHER');",
        '',
      ].join('\n'),
    );
  });

  it('reads the form of a plan: one without it was written for the move to factories', () => {
    expect(planTarget('{"contexts":{}}')).toBe('factories');
    expect(planTarget('{"to":"named","contexts":{}}')).toBe('named');
    expect(planTarget(undefined)).toBe('named');
  });
});

describe('error-factories --plan to the named form, the name of each factory', () => {
  it('names it after its first parameter, an Id suffix dropped, and after the concept when it has none or destructures it', () => {
    const root = tempDir('error-factories-named-factory');

    cli(root, 'init', '--refusals', 'factories');
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book');

    write(
      root,
      'src/contexts/scheduling/domain/errors/slot.error.ts',
      concept(
        TAKEN,
        GONE,
        "  static bookingTooFar(horizon: number) {\n    return SlotError.refusal('BOOKING_TOO_FAR', 'Too far.', { horizon });\n  }",
        "  static unreachable(recipientId: string, at: Date) {\n    return SlotError.refusal('RECIPIENT_UNREACHABLE', 'Unreachable.', { recipientId, at });\n  }",
        "  static overlapping({ from, to }: { from: Date; to: Date }) {\n    return SlotError.refusal('SLOT_OVERLAPPING', 'Overlapping.', { from, to });\n  }",
        "  static unread(cause: unknown) {\n    return SlotError.refusal('SLOTS_UNREAD', 'Unread.').causedBy(cause);\n  }",
      ),
    );

    cli(root, 'error-factories', '--plan');

    const plan = JSON.parse(read(root, 'error-factories.plan.json')) as {
      contexts: Record<string, { from: string; factory: string }[]>;
    };

    expect(plan.contexts['scheduling']?.map(({ from, factory }) => [from, factory])).toEqual([
      ['SlotError.taken', 'forSlot'],
      ['SlotError.gone', 'forSlot'],
      ['SlotError.bookingTooFar', 'forHorizon'],
      ['SlotError.unreachable', 'forRecipient'],
      ['SlotError.overlapping', 'forSlot'],
      ['SlotError.unread', 'becauseOf'],
    ]);
  });
});

describe('error-factories to the named form, what it leaves to a person', () => {
  it('keeps a concept class that still has a factory, and says the spec it could not cut', () => {
    const root = tempDir('error-factories-named-left');
    const errors = 'src/contexts/scheduling/domain/errors';

    cli(root, 'init', '--refusals', 'factories');
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book');

    write(
      root,
      `${errors}/slot.error.ts`,
      concept(TAKEN, '  static coded(code: string) {\n    return SlotError.refusal(code, "Coded.");\n  }'),
    );

    write(
      root,
      'src/contexts/scheduling/test/unit/slot.error.spec.ts',
      "import { it } from 'vitest';\n\nconst slot = aSlot();\n\ndescribe('SlotError', () => {\n  it('a', () => SlotError.taken(slot));\n});\n",
    );

    cli(root, 'error-factories', '--plan');

    const applied = cli(root, 'error-factories', '--apply', '--json').json() as { manual: string[] };

    expect(applied.manual.slice(0, 2)).toEqual([
      `${errors}/slot.error.ts: SlotError keeps coded: give each refusal it builds a class of its own by hand, then remove it.`,
      'src/contexts/scheduling/test/unit/slot.error.spec.ts: its cases share a setup or code around them: move each one to the spec of its refusal class by hand.',
    ]);

    expect(read(root, `${errors}/slot.error.ts`)).toBe(
      `import { ConceptError } from '@ddd-ts-kit/kernel';\n\nexport class SlotError extends ConceptError {\n  static coded(code: string) {\n    return SlotError.refusal(code, "Coded.");\n  }\n}\n`,
    );

    expect(read(root, 'src/contexts/scheduling/test/unit/slot.error.spec.ts')).toContain(
      "it('a', () => SlotTaken.forSlot(slot));",
    );
  });

  it('says what knip is to be told when its config is not a knip.json it can edit', () => {
    const root = tempDir('error-factories-named-knip');

    cli(root, 'init', '--refusals', 'factories');
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book');
    write(root, 'src/contexts/scheduling/domain/errors/slot.error.ts', concept(TAKEN));
    fs.rmSync(path.join(root, 'knip.json'));
    write(root, 'knip.config.ts', 'export default {};\n');
    cli(root, 'error-factories', '--plan');

    const applied = cli(root, 'error-factories', '--apply', '--json').json() as { written: string[]; manual: string[] };

    expect(applied.written).not.toContain('knip.json');

    expect(applied.manual).toContain(
      'Tell knip that the code types are a contract: add `"ignoreIssues": { "src/contexts/*/domain/errors/codes.ts": ["types"] }` to its config.',
    );
  });
});
