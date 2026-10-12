import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const { SCHEDULING } = PATHS;
const REMINDER_ERROR = 'src/contexts/notification/domain/errors/reminder.error.ts';
const SCHEDULER = `${SCHEDULING}/domain/services/scheduler.service.ts`;
const ROUTE = `${SCHEDULING}/presentation/http/get-appointment.route.ts`;
const CLOSING = '    );\n  }\n}\n';

/** How a domain error is written: through a factory of its concept class, under a code of its own. */
export const ERROR_INJECTIONS: readonly Injection[] = [
  {
    rule: 'errors/through-factory',
    what: 'a refusal built with new outside its error class',
    file: SCHEDULER,
    changes: [
      {
        file: SCHEDULER,
        from: 'throw AppointmentError.slotTaken(calendar.id, slot.startsAt);',
        to: "throw new AppointmentError('SLOT_TAKEN', 'The slot is held.', {});",
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/errors-through-factory',
  },
  {
    rule: 'errors/constructor-not-public',
    what: 'an error class with a public constructor',
    file: REMINDER_ERROR,
    changes: [
      {
        file: REMINDER_ERROR,
        from: CLOSING,
        to: `${CLOSING.slice(0, -2)}\n  public constructor(code: string, message: string) {\n    super(code, message, {});\n  }\n}\n`,
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/errors-constructor-not-public',
  },
  {
    rule: 'errors/factory-name',
    what: 'a factory whose code says something else than its name',
    file: REMINDER_ERROR,
    changes: [{ file: REMINDER_ERROR, from: "'REMINDER_NOT_DUE'", to: "'REMINDER_REFUSED'" }],
    checker: false,
    eslint: 'ddd-ts-kit/errors-factory-name',
  },
  {
    rule: 'errors/code-unique',
    what: 'two factories of a context under one code',
    file: REMINDER_ERROR,
    changes: [
      {
        file: REMINDER_ERROR,
        from: CLOSING,
        to: `${CLOSING.slice(0, -2)}\n  static reminderNotDue(reminderId: string) {\n    return ReminderError.refusal('REMINDER_NOT_DUE', \`The reminder \${reminderId} is not due.\`, { reminderId });\n  }\n}\n`,
      },
    ],
    checker: true,
  },
  {
    rule: 'errors/known-code',
    what: 'a route declaring a code no refusal sets',
    file: ROUTE,
    changes: [{ file: ROUTE, from: "'APPOINTMENT_NOT_FOUND'", to: "'APPOINTMENT_MISSING'" }],
    checker: true,
  },
];
