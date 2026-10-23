import { expect } from 'vitest';
import { cli, tempDir, write } from '../helpers';

/** Where the files of the scheduling context of the fixture are. */
export const SCHEDULING = 'src/contexts/scheduling';

export const BILLING = 'src/contexts/billing';

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

const APPOINTMENT_ERROR = lines(
  "import { ConceptError } from '@ddd-ts-kit/kernel';",
  "import type { AppointmentId } from '@/contexts/scheduling/domain/value-objects/appointment-id';",
  '',
  'export class AppointmentError extends ConceptError {',
  '  /** The appointment is over: nothing changes it any more. */',
  '  static ended(appointmentId: AppointmentId, endedAt: Date) {',
  '    return AppointmentError.refusal(',
  "      'APPOINTMENT_ENDED',",
  '      `Appointment ${appointmentId.value} ended at ${endedAt.toISOString()}.`,',
  '      { appointmentId: appointmentId.value, endedAt },',
  "    ).exposing('endedAt');",
  '  }',
  '',
  '  static agendaUnreachable(cause: unknown) {',
  "    return AppointmentError.refusal('AGENDA_UNREACHABLE', 'The agenda cannot be read.').causedBy(cause);",
  '  }',
  '',
  '  static alreadyCancelled() {',
  "    return AppointmentError.refusal('APPOINTMENT_ALREADY_CANCELLED', 'The appointment is already cancelled.');",
  '  }',
  '}',
);

const APPOINTMENT_ERROR_SPEC = lines(
  "import { describe, expect, it } from 'vitest';",
  "import { DomainError } from '@ddd-ts-kit/kernel';",
  "import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';",
  "import { AppointmentId } from '@/contexts/scheduling/domain/value-objects/appointment-id';",
  '',
  "describe('AppointmentError', () => {",
  '  it(\'refuses "ended" with the code APPOINTMENT_ENDED\', () => {',
  "    const error = AppointmentError.ended(AppointmentId.of('a-1'), new Date(0));",
  '',
  '    expect(error).toBeInstanceOf(AppointmentError);',
  '    expect(error.exposedFacts).toEqual({ endedAt: new Date(0) });',
  '  });',
  '',
  "  describe('agendaUnreachable', () => {",
  "    it('keeps the cause', () => {",
  "      const cause = new Error('down');",
  '',
  '      expect(AppointmentError.agendaUnreachable(cause).cause).toBe(cause);',
  '    });',
  '  });',
  '',
  '  it(\'refuses "alreadyCancelled" with the code APPOINTMENT_ALREADY_CANCELLED\', () => {',
  '    const error = AppointmentError.alreadyCancelled();',
  '',
  '    expect(error).toBeInstanceOf(DomainError);',
  "    expect(AppointmentError.is(error, 'APPOINTMENT_ALREADY_CANCELLED')).toBe(true);",
  '  });',
  '});',
);

const AGGREGATE = lines(
  "import { AggregateRoot } from '@ddd-ts-kit/kernel';",
  "import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';",
  "import type { AppointmentId } from '@/contexts/scheduling/domain/value-objects/appointment-id';",
  '',
  'export class Appointment extends AggregateRoot<AppointmentId> {',
  '  private cancelled = false;',
  '',
  '  cancel(at: Date, endsAt: Date): void {',
  '    if (this.cancelled) {',
  '      throw AppointmentError.alreadyCancelled();',
  '    }',
  '',
  '    if (endsAt <= at) {',
  '      throw AppointmentError.ended(this.id, endsAt);',
  '    }',
  '',
  '    this.cancelled = true;',
  '  }',
  '}',
);

const HANDLER = lines(
  "import type { CodeOf } from '@ddd-ts-kit/kernel';",
  "import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';",
  "import type { Agenda } from '@/contexts/scheduling/application/ports/agenda.port';",
  '',
  '/** What the route answers when the agenda refuses. */',
  'export type CancelRefusal = CodeOf<typeof AppointmentError>;',
  '',
  'export class CancelAppointmentHandler {',
  '  constructor(private readonly agenda: Agenda) {}',
  '',
  '  async execute(id: string): Promise<void> {',
  '    try {',
  '      await this.agenda.cancel(id);',
  '    } catch (error) {',
  "      if (AppointmentError.is(error, 'APPOINTMENT_ENDED')) {",
  '        return;',
  '      }',
  '',
  '      if (AppointmentError.is(error)) {',
  '        throw error;',
  '      }',
  '',
  '      throw AppointmentError.agendaUnreachable(error);',
  '    }',
  '  }',
  '}',
);

const ROUTE = lines(
  "import { defineRoute } from '@ddd-ts-kit/http';",
  '',
  'export const cancelAppointmentRoute = defineRoute({',
  "  method: 'POST',",
  "  path: '/appointments/:id/cancel',",
  "  errors: ['APPOINTMENT_ENDED', 'APPOINTMENT_ALREADY_CANCELLED'],",
  '});',
);

const AGGREGATE_SPEC = lines(
  "import { describe, expect, it } from 'vitest';",
  "import { expectRefusal } from '@ddd-ts-kit/testing';",
  "import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';",
  "import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';",
  '',
  "describe('Appointment', () => {",
  "  it('refuses to cancel an appointment that ended', () => {",
  '    const appointment = anAppointment().build();',
  '',
  "    expectRefusal(() => appointment.cancel(new Date(2), new Date(1)), 'APPOINTMENT_ENDED', { endedAt: new Date(1) });",
  '  });',
  '',
  "  it('narrows what it catches', () => {",
  '    try {',
  '      anAppointment().cancelled().build().cancel(new Date(0), new Date(1));',
  '    } catch (error) {',
  "      expect(AppointmentError.is(error, 'APPOINTMENT_ALREADY_CANCELLED')).toBe(true);",
  '    }',
  '  });',
  '});',
);

const INVOICE_ERROR = lines(
  "import { ConceptError } from '@ddd-ts-kit/kernel';",
  '',
  'export class InvoiceError extends ConceptError {',
  '  static notFound(invoiceId: string) {',
  "    return InvoiceError.refusal('INVOICE_NOT_FOUND', `Invoice ${invoiceId} does not exist.`, { invoiceId }).exposing(",
  "      'invoiceId',",
  '    );',
  '  }',
  '}',
);

const PAY_HANDLER = lines(
  "import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';",
  '',
  'export const pay = (invoiceId: string, known: boolean): void => {',
  '  if (!known) {',
  '    throw InvoiceError.notFound(invoiceId);',
  '  }',
  '};',
);

const PLATFORM = lines(
  "import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';",
  '',
  "export const isMissingInvoice = (error: unknown): boolean => InvoiceError.is(error, 'INVOICE_NOT_FOUND');",
);

const NOTES = lines(
  '# Refusals',
  '',
  'An appointment that ended is refused with `AppointmentError.ended(appointmentId, endedAt)`.',
  'Billing answers the refusals of `InvoiceError`.',
  'The word `AppointmentErrors` names something else.',
  '',
  '<!-- ddd-ts-kit:reference -->',
  '`AppointmentError.alreadyCancelled` is written again by docs.',
  '<!-- /ddd-ts-kit:reference -->',
);

/** Where the fixture keeps a document of its team that names the refusals. */
export const NOTES_FILE = 'docs/architecture/refusals.md';

/**
 * A project of the factories form in two contexts: scheduling, whose `AppointmentError` has a
 * factory that exposes a fact, one that keeps its cause and one without parameter, used by an
 * aggregate, a handler, a route and specs; billing, whose `InvoiceError` a file of the platform reads.
 * A document of the team names both.
 */
export function conceptErrorsProject(): string {
  const root = tempDir('error-factories-named');

  expect(cli(root, 'init', '--refusals', 'factories').code).toBe(0);

  expect(
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Appointment=A booked meeting')
      .code,
  ).toBe(0);

  expect(
    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'supporting',
      '--term',
      'Invoice=A request for payment',
    ).code,
  ).toBe(0);

  write(root, `${SCHEDULING}/domain/errors/appointment.error.ts`, APPOINTMENT_ERROR);
  write(root, `${SCHEDULING}/test/unit/appointment.error.spec.ts`, APPOINTMENT_ERROR_SPEC);
  write(root, `${SCHEDULING}/domain/aggregates/appointment.aggregate.ts`, AGGREGATE);
  write(root, `${SCHEDULING}/application/commands/cancel-appointment/cancel-appointment.handler.ts`, HANDLER);
  write(root, `${SCHEDULING}/presentation/http/cancel-appointment.route.ts`, ROUTE);
  write(root, `${SCHEDULING}/test/unit/appointment.aggregate.spec.ts`, AGGREGATE_SPEC);
  write(root, `${BILLING}/domain/errors/invoice.error.ts`, INVOICE_ERROR);
  write(root, `${BILLING}/application/commands/pay/pay.handler.ts`, PAY_HANDLER);
  write(root, 'src/platform/invoices.ts', PLATFORM);
  write(root, NOTES_FILE, NOTES);

  return root;
}
