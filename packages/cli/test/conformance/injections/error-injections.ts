import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const { NOTIFICATION, SCHEDULING } = PATHS;
const REMINDER_ERROR = `${NOTIFICATION}/domain/errors/reminder-not-due.error.ts`;
const CODES = `${NOTIFICATION}/domain/errors/codes.ts`;
const SCHEDULER = `${SCHEDULING}/domain/calendars/services/scheduler.service.ts`;
const ROUTE = `${SCHEDULING}/presentation/http/appointments/get-appointment/get-appointment.controller.ts`;
const CLOSING = '    );\n  }\n}\n';
const LISTED = "  ReminderNotDue: 'REMINDER_NOT_DUE',\n";

/** How a domain error is written: one class per refusal, built by its factories, under a code of the list of its context. */
export const ERROR_INJECTIONS: readonly Injection[] = [
  {
    rule: 'errors/through-factory',
    what: 'a refusal built with new outside its error class',
    file: SCHEDULER,
    changes: [
      {
        file: SCHEDULER,
        from: 'throw SlotTaken.forCalendar(calendar.id, slot.startsAt);',
        to: "throw new SlotTaken('The slot is held.');",
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/errors-through-factory',
  },
  {
    rule: 'errors/constructor-not-public',
    what: 'a refusal class with a public constructor',
    file: REMINDER_ERROR,
    changes: [
      {
        file: REMINDER_ERROR,
        from: CLOSING,
        to: `${CLOSING.slice(0, -2)}\n  public constructor(message: string) {\n    super(message);\n  }\n}\n`,
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/errors-constructor-not-public',
  },
  {
    rule: 'errors/factory-name',
    what: 'a factory named without a prefix that says what the refusal is about',
    file: REMINDER_ERROR,
    changes: [
      {
        file: REMINDER_ERROR,
        from: CLOSING,
        to: `${CLOSING.slice(0, -2)}\n  static notDue(reminderId: string) {\n    return ReminderNotDue.refusal('The reminder is not due.', { reminderId });\n  }\n}\n`,
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/errors-factory-name',
  },
  {
    rule: 'errors/code-unique',
    what: 'two refusals of a context under one code',
    file: CODES,
    changes: [{ file: CODES, from: "'INVALID_NOTIFICATION_KIND'", to: "'REMINDER_NOT_DUE'" }],
    checker: true,
  },
  {
    rule: 'errors/code-listed',
    what: 'a code list holding a code no refusal class sets',
    file: CODES,
    changes: [{ file: CODES, from: LISTED, to: `${LISTED}  ReminderLate: 'REMINDER_LATE',\n` }],
    checker: true,
  },
  {
    rule: 'errors/known-code',
    what: 'a controller declaring a code no refusal sets',
    file: ROUTE,
    changes: [{ file: ROUTE, from: "'APPOINTMENT_NOT_FOUND'", to: "'APPOINTMENT_MISSING'" }],
    checker: true,
  },
];
