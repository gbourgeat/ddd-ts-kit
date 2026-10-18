import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers.js';
import { failure } from './reports.js';

const ERRORS = 'src/contexts/scheduling/domain/errors';
const APPLICATION = 'src/contexts/scheduling/application';
const PLAN = 'error-factories.plan.json';

interface Entry {
  from: string;
  file: string;
  code: string;
  class: string;
  factory: string;
}

interface Plan {
  to: string;
  contexts: Record<string, unknown>;
}

interface Applied {
  moved: string[];
  manual: string[];
}

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

const slotError = (...factories: string[]): string =>
  lines(
    "import { ConceptError } from '@ddd-ts-kit/kernel';",
    '',
    'export class SlotError extends ConceptError {',
    factories.join('\n\n'),
    '}',
  );

const factory = (name: string, parameters: string, code: string): string =>
  `  static ${name}(${parameters}) {\n    return SlotError.refusal('${code}', 'Refused.');\n  }`;

const legacy = (name: string, code: string, ...body: string[]): string =>
  lines(
    "import { DomainError } from '@ddd-ts-kit/kernel';",
    '',
    `export class ${name} extends DomainError {`,
    `  readonly code = '${code}';`,
    ...body,
    '}',
  );

/** A project whose scheduling context knows the slot, `init` given `refusals`, with `files` written in it. */
function slotProject(refusals: string, files: Readonly<Record<string, string>>): string {
  const root = tempDir(`error-factories-named-plan-${refusals}`);

  expect(cli(root, 'init', '--refusals', refusals).code).toBe(0);

  expect(
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book').code,
  ).toBe(0);

  for (const [file, text] of Object.entries(files)) {
    write(root, file, text);
  }

  return root;
}

const plannedOf = (root: string): string[][] => {
  const plan = JSON.parse(read(root, PLAN)) as { contexts: Record<string, Entry[]> };

  return (plan.contexts['scheduling'] ?? []).map((entry) => [entry.from, entry.class, entry.factory]);
};

describe('error-factories --plan to the named form, the names it proposes', () => {
  it('names a second refusal of one code after its own factory, and leaves a class that says only ERROR to a person', () => {
    const root = slotProject('factories', {
      [`${ERRORS}/slot.error.ts`]: slotError(
        factory('taken', 'slotId: string', 'SLOT_TAKEN'),
        factory('takenTwice', 'slotId: string', 'SLOT_TAKEN'),
        factory('failed', '', 'ERROR'),
      ),
    });

    expect(cli(root, 'error-factories', '--plan').code).toBe(0);

    expect(plannedOf(root)).toEqual([
      ['SlotError.taken', 'SlotTaken', 'forSlot'],
      ['SlotError.takenTwice', 'SlotTaken', 'forTakenTwice'],
      ['SlotError.failed', 'Error', 'forSlot'],
    ]);

    expect(failure(cli(root, 'error-factories', '--apply', '--json')).message).toBe(
      `${PLAN}: "Error" is not the name of the refusal SlotError.failed builds.`,
    );
  });

  it('names a refusal of a thing not found after the unknown thing, its code kept', () => {
    const root = slotProject('classes', {
      [`${ERRORS}/slot.error.ts`]: slotError(
        factory('notFound', 'slotId: string', 'SLOT_NOT_FOUND'),
        factory('noAgenda', '', 'NOT_FOUND_AGENDA'),
        factory('missing', '', 'NOT_FOUND'),
      ),
      [`${ERRORS}/time-zone-not-found.error.ts`]: legacy('TimeZoneNotFoundError', 'TIME_ZONE_NOT_FOUND'),
    });

    expect(cli(root, 'error-factories', '--plan').code).toBe(0);

    const plan = JSON.parse(read(root, PLAN)) as { contexts: Record<string, Entry[]> };

    expect(plan.contexts['scheduling']?.map((entry) => [entry.from, entry.code, entry.class])).toEqual([
      ['SlotError.notFound', 'SLOT_NOT_FOUND', 'UnknownSlot'],
      ['SlotError.noAgenda', 'NOT_FOUND_AGENDA', 'UnknownAgenda'],
      ['SlotError.missing', 'NOT_FOUND', 'NotFound'],
      ['TimeZoneNotFoundError', 'TIME_ZONE_NOT_FOUND', 'UnknownTimeZone'],
    ]);
  });

  it('names the factory of a class per error after its concept or its context when its constructor says nothing', () => {
    const root = slotProject('classes', {
      [`${ERRORS}/slot-gone.error.ts`]: legacy('SlotGoneError', 'SLOT_GONE'),
      [`${ERRORS}/agenda-closed.error.ts`]: legacy(
        'AgendaClosedError',
        'AGENDA_CLOSED',
        '',
        '  constructor() {',
        "    super('The agenda is closed.');",
        '  }',
      ),
    });

    expect(cli(root, 'generate', 'aggregate', 'scheduling', 'Slot').code).toBe(0);
    expect(cli(root, 'error-factories', '--plan').code).toBe(0);

    expect(plannedOf(root)).toEqual([
      ['AgendaClosedError', 'AgendaClosed', 'forScheduling'],
      ['SlotGoneError', 'SlotGone', 'forSlot'],
    ]);
  });
});

describe('error-factories --apply to the named form, a plan it refuses or reads as empty', () => {
  let root: string;
  let plan: Plan;
  let entries: Entry[];

  beforeAll(() => {
    root = slotProject('factories', {
      [`${ERRORS}/slot.error.ts`]: slotError(
        factory('taken', 'slotId: string', 'SLOT_TAKEN'),
        factory('gone', '', 'SLOT_GONE'),
        "  static coded(code: string) {\n    return SlotError.refusal(code, 'Coded.');\n  }",
      ),
    });

    expect(cli(root, 'error-factories', '--plan').code).toBe(0);
    plan = JSON.parse(read(root, PLAN)) as Plan;
    entries = plan.contexts['scheduling'] as Entry[];
  });

  const applying = (contexts: Record<string, unknown>): ReturnType<typeof cli> => {
    write(root, PLAN, JSON.stringify({ ...plan, contexts }));

    return cli(root, 'error-factories', '--apply', '--dry-run', '--json');
  };

  it('moves nothing of a context whose entries are not a list', () => {
    expect((applying({ scheduling: 'none' }).json() as Applied).moved).toEqual([]);
  });

  it('leaves an entry of a factory no longer there, and says one whose code is not a literal', () => {
    const file = `${ERRORS}/slot.error.ts`;
    const coded = { from: 'SlotError.coded', file, code: 'SLOT_CODED', class: 'SlotCoded', factory: 'forSlot' };
    const vanished = { ...coded, from: 'SlotError.vanished', code: 'SLOT_VANISHED', class: 'SlotVanished' };
    const applied = applying({ scheduling: [...entries, coded, vanished] }).json() as Applied;

    expect(applied.moved).toEqual(['SlotError.taken -> SlotTaken.forSlot', 'SlotError.gone -> SlotGone.forSlot']);

    expect(applied.manual).toContain(
      `${file}: SlotError.coded is left as it is, its code is not one string literal followed by a message.`,
    );

    expect(applied.manual.join('\n')).not.toContain('vanished');
  });

  it.each([
    ['an entry that is not an object', (): unknown[] => ['SlotError.taken']],
    ['an entry without what it moves from', (): unknown[] => entries.map((entry) => ({ ...entry, from: ' ' }))],
  ])('refuses %s', (_, scheduling) => {
    expect(failure(applying({ scheduling: scheduling() })).message).toBe(
      `${PLAN} has an entry without what it moves from, its file or its code.`,
    );
  });

  it('refuses a factory planned twice', () => {
    expect(failure(applying({ scheduling: [...entries, entries[0]] })).message).toBe(
      `${PLAN}: SlotTaken.forSlot is planned twice.`,
    );
  });
});

describe('error-factories --apply to the named form, from classes per error', () => {
  let root: string;
  let applied: Applied;

  beforeAll(() => {
    root = slotProject('classes', {
      [`${ERRORS}/slot-refused.error.ts`]: legacy(
        'SlotRefusedError',
        'SLOT_REFUSED',
        '',
        '  constructor(slotId: string, at: Date, by: string, reason: string) {',
        '    super(`Slot ${slotId} refused at ${at.toISOString()} by ${by}: ${reason}.`);',
        '  }',
      ),
      [`${ERRORS}/slot-locked.error.ts`]: lines(
        'export class SlotLockedError extends DomainError {',
        "  readonly code = 'SLOT_LOCKED';",
        '}',
      ),
      [`${APPLICATION}/lock.ts`]: lines(
        "import { SlotLockedError } from '@/contexts/scheduling/domain/errors/slot-locked.error'",
        '',
        "export const lock = (): SlotLockedError => new SlotLockedError('Locked.')",
      ),
    });

    expect(cli(root, 'error-factories', '--plan').code).toBe(0);
    applied = cli(root, 'error-factories', '--apply', '--json').json() as Applied;
  });

  it('says the factory that takes more than three parameters', () => {
    expect(applied.moved).toContain('SlotRefusedError -> SlotRefused.forSlot');

    expect(applied.manual).toContain('SlotRefused.forSlot takes more than three parameters, give it one typed object.');
  });

  it('moves a class whose file imports nothing, and rewrites an import written without its semicolon', () => {
    expect(applied.moved).toContain('SlotLockedError -> SlotLocked.withMessage');
    expect(exists(root, `${ERRORS}/slot-locked.error.ts`)).toBe(true);

    expect(read(root, `${APPLICATION}/lock.ts`)).toBe(
      lines(
        "import { SlotLocked } from '@/contexts/scheduling/domain/errors/slot-locked.error';",
        '',
        "export const lock = (): SlotLocked => SlotLocked.withMessage('Locked.')",
      ),
    );
  });
});
