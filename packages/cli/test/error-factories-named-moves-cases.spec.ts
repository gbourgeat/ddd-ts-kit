import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { failure } from './reports';

const ERRORS = 'src/contexts/scheduling/domain/errors';
const UNIT = 'src/contexts/scheduling/test/unit';
const PLAN = 'error-factories.plan.json';

interface Applied {
  moved: string[];
  removed: string[];
  manual: string[];
}

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

const conceptError = (className: string, ...members: string[]): string =>
  lines(
    "import { ConceptError } from '@ddd-ts-kit/kernel';",
    '',
    `export class ${className} extends ConceptError {`,
    members.join('\n\n'),
    '}',
  );

const factory = (name: string, parameters: string, code: string): string =>
  `  static ${name}(${parameters}) {\n    return this.refusal('${code}', 'Refused.');\n  }`;

const TAKEN = factory('taken', 'slotId: string', 'SLOT_TAKEN');
const GONE = factory('gone', '', 'SLOT_GONE');

/** A project of the factories form whose scheduling context knows the slot, with `files` written in it and planned. */
function plannedProject(files: Readonly<Record<string, string>>): string {
  const root = tempDir('error-factories-named-moves');

  expect(cli(root, 'init', '--refusals', 'factories').code).toBe(0);

  expect(
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book').code,
  ).toBe(0);

  for (const [file, text] of Object.entries(files)) {
    write(root, file, text);
  }

  expect(cli(root, 'error-factories', '--plan').code).toBe(0);

  return root;
}

const apply = (root: string): Applied => cli(root, 'error-factories', '--apply', '--json').json() as Applied;

describe('error-factories --apply to the named form, a refusal class already there', () => {
  it('gives a class written by hand the factory the plan moves to it, and its spec the cases', () => {
    const root = plannedProject({
      [`${ERRORS}/slot.error.ts`]: conceptError('SlotError', TAKEN),
      [`${UNIT}/slot.error.spec.ts`]: lines(
        "describe('SlotError', () => {",
        "  it('refuses a taken slot', () => {",
        "    expect(SlotError.taken('s-1').code).toBe('SLOT_TAKEN');",
        '  });',
        '});',
      ),
      [`${ERRORS}/codes.ts`]: lines('export const SchedulingCodes = {', "  SlotTaken: 'SLOT_TAKEN',", '} as const;'),
      [`${ERRORS}/slot-taken.error.ts`]: lines(
        "import { DomainRefusal } from '@ddd-ts-kit/kernel';",
        "import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';",
        '',
        'export class SlotTaken extends DomainRefusal {',
        '  readonly code = SchedulingCodes.SlotTaken;',
        '',
        '  static atNoon() {',
        "    return SlotTaken.refusal('Taken at noon.');",
        '  }',
        '}',
      ),
      [`${UNIT}/slot-taken.error.spec.ts`]: lines(
        "import { describe, expect, it } from 'vitest';",
        '',
        "describe('SlotTaken', () => {",
        "  it('refuses at noon', () => {",
        "    expect(SlotTaken.atNoon().code).toBe('SLOT_TAKEN');",
        '  });',
        '});',
      ),
    });

    expect(apply(root).moved).toEqual(['SlotError.taken -> SlotTaken.forSlot']);

    const source = read(root, `${ERRORS}/slot-taken.error.ts`);

    expect(source.indexOf('static atNoon()')).toBeLessThan(source.indexOf('static forSlot(slotId: string)'));
    expect(source).toContain("  static forSlot(slotId: string) {\n    return this.refusal('Refused.');\n  }\n}\n");

    const spec = read(root, `${UNIT}/slot-taken.error.spec.ts`);

    expect(spec.indexOf("it('refuses at noon'")).toBeLessThan(spec.indexOf("it('refuses a taken slot'"));
    expect(spec).toContain("expect(SlotTaken.forSlot('s-1').code).toBe('SLOT_TAKEN');");
  });

  it('refuses to write a refusal class over a file that holds another class, and writes nothing', () => {
    const root = plannedProject({
      [`${ERRORS}/slot.error.ts`]: conceptError(
        'SlotError',
        factory('ended', 'slotId: string', 'SLOT_ENDED'),
        factory('endedLongAgo', 'slotId: string', 'SLOT_ENDED'),
      ),
      [`${ERRORS}/slot-ended.error.ts`]: 'export class Ended {}\n',
    });

    expect(failure(cli(root, 'error-factories', '--apply', '--json'))).toEqual({
      message: `${ERRORS}/slot-ended.error.ts holds another class than SlotEnded.`,
      fix: 'Give SlotEnded another name in the plan, then run `ddd-ts-kit error-factories --apply` again.',
    });

    expect(read(root, `${ERRORS}/slot-ended.error.ts`)).toBe('export class Ended {}\n');
  });
});

describe('error-factories --apply to the named form, what a concept class keeps', () => {
  let root: string;
  let applied: Applied;

  const AGENDA = conceptError('AgendaError', factory('closed', '', 'AGENDA_CLOSED'));
  const AGENDA_SPEC = lines("it('refuses a closed agenda', () => AgendaError.closed());");

  beforeAll(() => {
    root = plannedProject({
      [`${ERRORS}/slot.error.ts`]: conceptError('SlotError', "  static readonly prefix = 'slot';", TAKEN, GONE),
      [`${UNIT}/slot.error.spec.ts`]: lines(
        "import { describe, it } from 'vitest';",
        '',
        "describe('SlotError', () => {",
        "  it('refuses a taken slot', () => SlotError.taken('s-1'));",
        '',
        "  it('refuses either', () => [SlotError.taken('s-1'), SlotError.gone()]);",
        '});',
      ),
      [`${ERRORS}/agenda.error.ts`]: AGENDA,
      [`${UNIT}/agenda.error.spec.ts`]: AGENDA_SPEC,
    });

    const plan = JSON.parse(read(root, PLAN)) as { contexts: Record<string, { from: string }[]> };

    plan.contexts['scheduling'] = (plan.contexts['scheduling'] ?? []).filter(
      (entry) => !entry.from.startsWith('Agenda'),
    );

    write(root, PLAN, JSON.stringify(plan));
    applied = apply(root);
  });

  it('leaves a concept class the plan no longer names, and its spec, as they are', () => {
    expect(applied.moved).toEqual(['SlotError.taken -> SlotTaken.forSlot', 'SlotError.gone -> SlotGone.forSlot']);
    expect(read(root, `${ERRORS}/agenda.error.ts`)).toBe(AGENDA);
    expect(read(root, `${UNIT}/agenda.error.spec.ts`)).toBe(AGENDA_SPEC);
    expect(applied.manual.join('\n')).not.toContain('AgendaError');
  });

  it('says a concept class that keeps members of its own once its factories moved', () => {
    expect(applied.manual).toContain(
      `${ERRORS}/slot.error.ts: SlotError keeps members of its own: give each refusal it builds a class of its own by hand, then remove it.`,
    );

    expect(read(root, `${ERRORS}/slot.error.ts`)).toContain("  static readonly prefix = 'slot';\n}\n");
  });

  it('keeps in the spec of the concept class a case that builds two refusals, rewritten, and moves the other', () => {
    expect(applied.removed).not.toContain(`${UNIT}/slot.error.spec.ts`);

    expect(read(root, `${UNIT}/slot.error.spec.ts`)).toContain(
      "describe('SlotError', () => {\n  it('refuses either', () => [SlotTaken.forSlot('s-1'), SlotGone.forSlot()]);\n});",
    );

    expect(read(root, `${UNIT}/slot-taken.error.spec.ts`)).toContain(
      "  it('refuses a taken slot', () => SlotTaken.forSlot('s-1'));",
    );
  });
});

describe('error-factories --apply to the named form, a spec of a concept class it cannot cut', () => {
  it.each([
    ['cases outside a describe', lines("it('refuses a taken slot', () => SlotError.taken('s-1'));")],
    [
      'a describe given a suite written above it',
      lines(
        "const cases = (): void => it('refuses a taken slot', () => SlotError.taken('s-1'));",
        '',
        "describe('SlotError', cases);",
      ),
    ],
  ])('says to move by hand %s', (_, spec) => {
    const root = plannedProject({
      [`${ERRORS}/slot.error.ts`]: conceptError('SlotError', TAKEN),
      [`${UNIT}/slot.error.spec.ts`]: spec,
    });

    expect(apply(root).manual).toContain(
      `${UNIT}/slot.error.spec.ts: its cases share a setup or code around them: move each one to the spec of its refusal class by hand.`,
    );

    expect(read(root, `${UNIT}/slot.error.spec.ts`)).toContain("SlotTaken.forSlot('s-1')");
  });
});

describe('error-factories --apply to the named form, a spec of a refusal class it cannot merge into', () => {
  const HELD = lines("import { it } from 'vitest';", '', "it.todo('refuses a taken slot at noon');");

  it('keeps the spec of the concept class, with the cases the class would take, and says it', () => {
    const root = plannedProject({
      [`${ERRORS}/slot.error.ts`]: conceptError('SlotError', TAKEN),
      [`${UNIT}/slot.error.spec.ts`]: lines(
        "describe('SlotError', () => {",
        "  it('refuses a taken slot', () => SlotError.taken('s-1'));",
        '});',
      ),
      [`${UNIT}/slot-taken.error.spec.ts`]: HELD,
    });

    const applied = apply(root);

    expect(applied.manual).toContain(
      `${UNIT}/slot-taken.error.spec.ts: no describe block was found, move the cases of SlotTaken from ${UNIT}/slot.error.spec.ts to it by hand.`,
    );

    expect(applied.removed).not.toContain(`${UNIT}/slot.error.spec.ts`);

    expect(read(root, `${UNIT}/slot.error.spec.ts`)).toContain(
      "describe('SlotError', () => {\n  it('refuses a taken slot', () => SlotTaken.forSlot('s-1'));\n});",
    );

    expect(read(root, `${UNIT}/slot-taken.error.spec.ts`)).toBe(HELD);
  });

  it.each([
    [
      'the spec of the class has no describe',
      lines("it('refuses late', () => new TooLateError());"),
      lines("describe('TooLate', () => {", "  it.todo('refuses late');", '});'),
      `${UNIT}/late.error.spec.ts: no describe block was found, move its cases to ${UNIT}/too-late.error.spec.ts by hand.`,
    ],
    [
      'the spec of the refusal class has no describe',
      lines("describe('TooLateError', () => {", "  it('refuses late', () => new TooLateError());", '});'),
      HELD,
      `${UNIT}/too-late.error.spec.ts: no describe block was found, move the cases of ${UNIT}/late.error.spec.ts to it by hand.`,
    ],
  ])('keeps the spec of a class per error when %s, and says it', (_, spec, held, said) => {
    const root = tempDir('error-factories-named-legacy-spec');

    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book');

    write(
      root,
      `${ERRORS}/late.error.ts`,
      lines(
        "import { DomainError } from '@ddd-ts-kit/kernel';",
        '',
        'export class TooLateError extends DomainError {',
        "  readonly code = 'TOO_LATE';",
        '}',
      ),
    );

    write(root, `${UNIT}/late.error.spec.ts`, spec);
    write(root, `${UNIT}/too-late.error.spec.ts`, held);
    expect(cli(root, 'error-factories', '--plan').code).toBe(0);

    const applied = apply(root);

    expect(applied.moved).toEqual(['TooLateError -> TooLate.withMessage']);
    expect(applied.manual).toContain(said);
    expect(applied.removed).not.toContain(`${UNIT}/late.error.spec.ts`);
    expect(read(root, `${UNIT}/late.error.spec.ts`)).toContain('TooLate.withMessage(');
    expect(read(root, `${UNIT}/too-late.error.spec.ts`)).toBe(held);
  });
});
