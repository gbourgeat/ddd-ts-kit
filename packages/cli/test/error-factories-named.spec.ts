import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers.js';
import { failure } from './reports.js';
import { BILLING, conceptErrorsProject, NOTES_FILE, SCHEDULING } from './support/concept-errors-project.js';

const PLAN = 'error-factories.plan.json';
const ERRORS = `${SCHEDULING}/domain/errors`;
const UNIT = `${SCHEDULING}/test/unit`;
const HANDLER = `${SCHEDULING}/application/commands/cancel-appointment/cancel-appointment.handler.ts`;

interface Plan {
  to: string;
  contexts: Record<string, { from: string; code: string; class: string; factory: string }[]>;
}

interface Applied {
  moved: string[];
  written: string[];
  removed: string[];
  manual: string[];
}

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

/** What the glossaries of the fixture (scheduling: Appointment; billing: Invoice) leave to a person in the names of the plan. */
const UNDEFINED_WORDS = [
  `\`AppointmentEnded\` uses "ended", which the glossary of "scheduling" does not define: define them in ${SCHEDULING}/CONTEXT.md or rename the class in the plan.`,
  `\`AgendaUnreachable\` uses "agenda", "unreachable", which the glossary of "scheduling" does not define: define them in ${SCHEDULING}/CONTEXT.md or rename the class in the plan.`,
  `\`AppointmentAlreadyCancelled\` uses "cancelled", which the glossary of "scheduling" does not define: define them in ${SCHEDULING}/CONTEXT.md or rename the class in the plan.`,
];

describe('error-factories --plan, to the named form', () => {
  let root: string;

  beforeAll(() => {
    root = conceptErrorsProject();
    expect(cli(root, 'error-factories', '--plan').code).toBe(0);
  });

  it('proposes, per factory of a concept class, a class named after its code and a factory for its first parameter', () => {
    const plan = JSON.parse(read(root, PLAN)) as Plan;

    expect(plan.to).toBe('named');

    expect(plan.contexts['scheduling']?.map((entry) => [entry.from, entry.code, entry.class, entry.factory])).toEqual([
      ['AppointmentError.ended', 'APPOINTMENT_ENDED', 'AppointmentEnded', 'forAppointment'],
      ['AppointmentError.agendaUnreachable', 'AGENDA_UNREACHABLE', 'AgendaUnreachable', 'becauseOf'],
      [
        'AppointmentError.alreadyCancelled',
        'APPOINTMENT_ALREADY_CANCELLED',
        'AppointmentAlreadyCancelled',
        'forAppointment',
      ],
    ]);

    expect(plan.contexts['billing']).toEqual([
      {
        from: 'InvoiceError.notFound',
        file: `${BILLING}/domain/errors/invoice.error.ts`,
        code: 'INVOICE_NOT_FOUND',
        class: 'UnknownInvoice',
        factory: 'forInvoice',
      },
    ]);
  });

  it('leaves to a person each proposed class whose words the glossary of its context does not define, a qualifier aside', () => {
    const said = cli(root, 'error-factories', '--plan').stdout;

    expect(said).toContain(`Left to you:\n  - ${UNDEFINED_WORDS[0]}\n`);
    expect((cli(root, 'error-factories', '--plan', '--json').json() as Applied).manual).toEqual(UNDEFINED_WORDS);
  });

  it.each([
    [{ class: 'AppointmentEndedError' }, '"AppointmentEndedError" is not the name of the refusal'],
    [{ factory: 'ended' }, '"ended" is not the name of a factory of AppointmentEnded'],
    [{ factory: 'forAppointment2' }, 'not the name of a factory'],
    [{ class: 'AgendaUnreachable' }, 'AgendaUnreachable is given two codes'],
  ])('refuses a plan whose names the named form does not accept', (edit, message) => {
    const kept = read(root, PLAN);
    const plan = JSON.parse(kept) as Plan;
    const [first, ...rest] = plan.contexts['scheduling'] ?? [];

    write(root, PLAN, JSON.stringify({ ...plan, contexts: { scheduling: [{ ...first, ...edit }, ...rest] } }));
    expect(failure(cli(root, 'error-factories', '--apply', '--json')).message).toContain(message);
    write(root, PLAN, kept);
  });

  it('applies a plan to the form it was written for only', () => {
    expect(failure(cli(root, 'error-factories', '--apply', '--to', 'factories', '--json')).message).toBe(
      `${PLAN} moves the project to "named", not to "factories".`,
    );

    expect(failure(cli(root, 'error-factories', '--plan', '--to', 'classes', '--json')).message).toContain(
      '"classes" is not a form error-factories moves a project to',
    );
  });

  it('writes nothing on a dry run, and says each file it would write or remove once', () => {
    const said = cli(root, 'error-factories', '--apply', '--dry-run').stdout;
    const files = said.split('\n').filter((line) => /^would (?:write|remove) /.test(line));

    expect(said).toContain('would move    AppointmentError.ended -> AppointmentEnded.forAppointment');
    expect(files).toContain(`would remove  ${UNIT}/appointment.error.spec.ts`);
    expect(new Set(files.map((line) => line.slice(14))).size).toBe(files.length);

    expect(exists(root, `${ERRORS}/codes.ts`)).toBe(false);
  });
});

let migrated: { root: string; applied: Applied } | undefined;

/** The fixture moved once to the named form, the factory of `AgendaUnreachable` renamed in the plan: the describes below read it. */
function migratedProject(): { root: string; applied: Applied } {
  if (migrated === undefined) {
    const root = conceptErrorsProject();

    cli(root, 'error-factories', '--plan');

    const plan = JSON.parse(read(root, PLAN)) as Plan;

    for (const entry of plan.contexts['scheduling'] ?? []) {
      entry.factory = entry.class === 'AgendaUnreachable' ? 'becauseOf' : entry.factory;
    }

    write(root, PLAN, JSON.stringify(plan));
    migrated = { root, applied: cli(root, 'error-factories', '--apply', '--json').json() as Applied };
  }

  return migrated;
}

describe('error-factories --apply, from factories to the named form', () => {
  let root: string;
  let applied: Applied;

  beforeAll(() => {
    ({ root, applied } = migratedProject());
  });

  it('moves each factory to a class of its own, as the plan names them', () => {
    expect(applied.moved).toEqual([
      'AppointmentError.ended -> AppointmentEnded.forAppointment',
      'AppointmentError.agendaUnreachable -> AgendaUnreachable.becauseOf',
      'AppointmentError.alreadyCancelled -> AppointmentAlreadyCancelled.forAppointment',
      'InvoiceError.notFound -> UnknownInvoice.forInvoice',
    ]);
  });

  it('writes the codes of each context, keyed by class, the codes kept', () => {
    expect(read(root, `${ERRORS}/codes.ts`)).toBe(
      lines(
        'export const SchedulingCodes = {',
        "  AppointmentEnded: 'APPOINTMENT_ENDED',",
        "  AgendaUnreachable: 'AGENDA_UNREACHABLE',",
        "  AppointmentAlreadyCancelled: 'APPOINTMENT_ALREADY_CANCELLED',",
        '} as const;',
        '',
        'export type SchedulingCode = (typeof SchedulingCodes)[keyof typeof SchedulingCodes];',
      ),
    );

    expect(read(root, `${BILLING}/domain/errors/codes.ts`)).toContain("  UnknownInvoice: 'INVOICE_NOT_FOUND',\n");
  });

  it('writes one class per refusal, its code read from the list, its factory as written with what it chains', () => {
    expect(read(root, `${ERRORS}/appointment-ended.error.ts`)).toBe(
      lines(
        "import { DomainRefusal } from '@ddd-ts-kit/kernel';",
        "import type { AppointmentId } from '@/contexts/scheduling/domain/value-objects/appointment-id';",
        "import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';",
        '',
        'export class AppointmentEnded extends DomainRefusal {',
        '  readonly code = SchedulingCodes.AppointmentEnded;',
        '',
        '  /** The appointment is over: nothing changes it any more. */',
        '  static forAppointment(appointmentId: AppointmentId, endedAt: Date) {',
        '    return AppointmentEnded.refusal(',
        '      `Appointment ${appointmentId.value} ended at ${endedAt.toISOString()}.`,',
        '      { appointmentId: appointmentId.value, endedAt },',
        "    ).exposing('endedAt');",
        '  }',
        '}',
      ),
    );

    expect(read(root, `${ERRORS}/agenda-unreachable.error.ts`)).toContain(
      "  static becauseOf(cause: unknown) {\n    return AgendaUnreachable.refusal('The agenda cannot be read.').causedBy(cause);\n  }\n",
    );

    expect(read(root, `${ERRORS}/appointment-already-cancelled.error.ts`)).toContain(
      "  static forAppointment() {\n    return AppointmentAlreadyCancelled.refusal('The appointment is already cancelled.');\n  }\n",
    );
  });

  it('removes the concept classes left empty, and gives each case of their spec to the class it builds', () => {
    expect(applied.removed).toEqual([
      `${ERRORS}/appointment.error.ts`,
      `${BILLING}/domain/errors/invoice.error.ts`,
      `${UNIT}/appointment.error.spec.ts`,
    ]);

    expect(read(root, `${UNIT}/agenda-unreachable.error.spec.ts`)).toBe(
      lines(
        "import { describe, expect, it } from 'vitest';",
        "import { AgendaUnreachable } from '@/contexts/scheduling/domain/errors/agenda-unreachable.error';",
        '',
        "describe('AgendaUnreachable', () => {",
        "  describe('becauseOf', () => {",
        "    it('keeps the cause', () => {",
        "      const cause = new Error('down');",
        '',
        '      expect(AgendaUnreachable.becauseOf(cause).cause).toBe(cause);',
        '    });',
        '  });',
        '});',
      ),
    );

    const ended = read(root, `${UNIT}/appointment-ended.error.spec.ts`);

    expect(ended).toContain(
      "import { AppointmentId } from '@/contexts/scheduling/domain/value-objects/appointment-id';",
    );

    expect(ended).not.toContain('DomainError');
    expect(ended).toContain('expect(error).toBeInstanceOf(AppointmentEnded);');

    expect(read(root, `${UNIT}/appointment-already-cancelled.error.spec.ts`)).toContain(
      'expect(AppointmentAlreadyCancelled.is(error)).toBe(true);',
    );
  });
});

describe('error-factories --apply, the usages of the refusals', () => {
  let root: string;
  let applied: Applied;

  beforeAll(() => {
    ({ root, applied } = migratedProject());
  });

  it('rewrites every usage, imports included, and leaves the codes of a route as they are', () => {
    const aggregate = read(root, `${SCHEDULING}/domain/aggregates/appointment.aggregate.ts`);

    expect(aggregate.match(/^import .*$/gm)).toEqual([
      "import { AggregateRoot } from '@ddd-ts-kit/kernel';",
      "import { AppointmentEnded } from '@/contexts/scheduling/domain/errors/appointment-ended.error';",
      "import { AppointmentAlreadyCancelled } from '@/contexts/scheduling/domain/errors/appointment-already-cancelled.error';",
      "import type { AppointmentId } from '@/contexts/scheduling/domain/value-objects/appointment-id';",
    ]);

    expect(aggregate).toContain('throw AppointmentAlreadyCancelled.forAppointment();');
    expect(aggregate).toContain('throw AppointmentEnded.forAppointment(this.id, endsAt);');
    expect(read(root, HANDLER)).toContain('if (AppointmentEnded.is(error)) {');
    expect(read(root, HANDLER)).toContain('throw AgendaUnreachable.becauseOf(error);');

    expect(read(root, `${SCHEDULING}/presentation/http/cancel-appointment.route.ts`)).toContain(
      "errors: ['APPOINTMENT_ENDED', 'APPOINTMENT_ALREADY_CANCELLED'],",
    );

    const spec = read(root, `${UNIT}/appointment.aggregate.spec.ts`);

    expect(spec).toContain("'APPOINTMENT_ENDED', { endedAt: new Date(1) });");
    expect(spec).toContain('expect(AppointmentAlreadyCancelled.is(error)).toBe(true);');
    expect(spec).not.toContain('AppointmentError');

    expect(read(root, `${BILLING}/application/commands/pay/pay.handler.ts`)).toContain(
      'throw UnknownInvoice.forInvoice(invoiceId);',
    );

    expect(read(root, 'src/platform/invoices.ts')).toBe(
      lines(
        "import { UnknownInvoice } from '@/contexts/billing/domain/errors/unknown-invoice.error';",
        '',
        'export const isMissingInvoice = (error: unknown): boolean => UnknownInvoice.is(error);',
      ),
    );
  });

  it('leaves to a person each class written whose words the glossary of its context does not define', () => {
    expect(applied.manual.filter((line) => line.startsWith('`'))).toEqual(UNDEFINED_WORDS);
  });

  it('says, with its line, what it cannot rewrite, and keeps the import it reads', () => {
    expect(applied.manual.slice(0, 2)).toEqual([
      `${HANDLER}:8: \`CodeOf<typeof AppointmentError>\` names the codes of a class that is gone: write the union of the codes it means, or the code type of codes.ts.`,
      `${HANDLER}:21: \`AppointmentError.is(..)\` without a code narrowed to every refusal of the concept: write the refusals it means, \`<Refusal>.is(error) || ..\`.`,
    ]);

    expect(read(root, HANDLER)).toContain(
      "import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';\nimport { AppointmentEnded } from",
    );
  });

  it('tells knip that the code types are a contract, as init does under the named form', () => {
    expect(applied.written).toContain('knip.json');

    expect(JSON.parse(read(root, 'knip.json'))).toMatchObject({
      ignoreIssues: { 'src/contexts/*/domain/errors/codes.ts': ['types'] },
    });
  });

  it('says the guides of the agents that describe the earlier form, and each line of a document that names what moved', () => {
    const rewrite = 'still describes the earlier form of the refusals: rewrite it from the named form';

    expect(applied.manual.filter((line) => line.includes(rewrite)).map((line) => line.split(' ')[0])).toEqual([
      '.claude/rules/domain.md',
      '.claude/rules/presentation.md',
      '.github/instructions/domain.instructions.md',
      '.github/instructions/presentation.instructions.md',
    ]);

    expect(applied.manual.filter((line) => line.startsWith(`${NOTES_FILE}:`))).toEqual([
      `${NOTES_FILE}:3: AppointmentError.ended is now AppointmentEnded.forAppointment: rewrite the sentence.`,
      `${NOTES_FILE}:4: InvoiceError is gone: name the refusal classes that replace it.`,
    ]);
  });

  it('says the form in the config, and leaves nothing the code list rules report', () => {
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { refusals: 'named' } });

    const report = cli(root, 'check', '--json').json() as { violations: { ruleId: string }[] };

    expect(report.violations.filter(({ ruleId }) => ruleId.startsWith('errors/'))).toEqual([]);
  });

  it('has nothing left to move when run again', () => {
    expect(cli(root, 'error-factories', '--apply', '--json').json()).toMatchObject({
      moved: [],
      written: [],
      removed: [],
    });
  });
});
