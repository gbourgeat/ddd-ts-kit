import type { RuleDoc } from '../model/rule-doc';

export const ERRORS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'errors/code-unique': {
    why: 'The code is the identity of a refusal for everything outside the domain: the HTTP mapper gives it a status, the OpenAPI document lists it, the audit trail and the span record it as the reason, a client branches on it and a test asserts it. Nothing downstream knows the class or the factory. Two refusals of one context under one code are therefore one refusal for every reader, whatever their messages say. The code is checked per context, since each context owns its language: the same code in two contexts is allowed, and the error mapper of the application gives it one status. Every form is read: the first argument of `refusal(..)` in a factory of a concept class, the `readonly code` field of a class per error, and under "stack.refusals": "named" the values of <context>.codes.ts, the code list of the context, where two keys under one value are reported. Judged under "stack.refusals": "factories" and "named": a project whose config does not say was written when an error was a class, and keeps working untouched.',
    bad: `// appointment.codes.ts
export const AppointmentCodes = {
  SlotTaken: 'BOOKING_REFUSED',
  OutsideAvailability: 'BOOKING_REFUSED',
} as const;`,
    good: `// appointment.codes.ts
export const AppointmentCodes = {
  SlotTaken: 'SLOT_TAKEN',
  OutsideAvailability: 'OUTSIDE_AVAILABILITY',
} as const;`,
  },
  'errors/code-listed': {
    why: 'Under "stack.refusals": "named" a refusal is a class of its own, `SlotTaken`, and its code is what everything outside the domain knows it by: the error mapper gives it a status, the OpenAPI document and the client list it, a test asserts it. The codes of a context are therefore one closed list, <context>.codes.ts, `export const SchedulingCodes = { SlotTaken: \'SLOT_TAKEN\' } as const`, and each class reads its code from it under its own name, `readonly code = SchedulingCodes.SlotTaken`: the list is the contract of the context in one file, two refusals cannot drift to one code unseen, and the type of each code stays its own literal. Reported: a refusal class (a class of domain/errors/ that extends DomainRefusal, abstract ones aside) without a code, with a code written another way (a string literal, another entry, the list of another context), a context with refusal classes and no codes.ts, a class whose name the list does not hold; in codes.ts, a list missing or not `as const`, a key that names no refusal class of the context (a code nothing raises), and a value that is not a string literal in constant case. The value is usually the name of the class in constant case, but need not be: a migrated project keeps its codes, since the code is the contract. Judged under "stack.refusals": "named" only.',
    bad: `// scheduling.codes.ts
export const SchedulingCodes = {
  SlotTaken: 'SLOT_TAKEN',
  SlotHeld: 'SLOT_HELD',
};

// domain/errors/slot-taken.error.ts
export class SlotTaken extends DomainRefusal {
  readonly code = 'SLOT_TAKEN';
}`,
    good: `// scheduling.codes.ts
export const SchedulingCodes = {
  SlotTaken: 'SLOT_TAKEN',
} as const;

export type SchedulingCode = (typeof SchedulingCodes)[keyof typeof SchedulingCodes];

// domain/errors/slot-taken.error.ts
export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string, startsAt: Date) {
    return SlotTaken.refusal(\`The slot starting at \${startsAt.toISOString()} is already held.\`, { calendarId, startsAt });
  }
}`,
  },
  'errors/known-code': {
    why: 'The `errors` list of a route is what the OpenAPI document promises: one problem response per status of the codes it names. A code written there that no refusal sets, misspelled or left behind by a renamed factory, is a response the contract documents and the API never gives, while the refusal really raised is missing from it. A code exists when a factory or an error class of the context of the route sets it, when the <context>.codes.ts of that context lists it (under "stack.refusals": "named"), when a class outside the contexts (the platform, the shared kernel) does, or when it is a code of the kit: VALIDATION_FAILED, NOT_FOUND, CONFLICT, INVARIANT_VIOLATION, UNAUTHORIZED, FORBIDDEN, NOT_ACCEPTABLE, CONCURRENCY_CONFLICT, INVALID_CRITERIA, INVALID_PAGE_REQUEST, TIMEOUT, CIRCUIT_OPEN, BULKHEAD_FULL, ATTEMPTS_EXHAUSTED, SERVICE_UNAVAILABLE (a unit of work the database could not serve in time), the conditions of a write: PRECONDITION_FAILED, PRECONDITION_REQUIRED, and the refusals of a file: FILE_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, FILE_NOT_FOUND, FILE_REJECTED, INVALID_FILE_KEY. A code another context sets does not count: a context answers with its own language. Judged under "stack.refusals": "factories" and "named".',
    bad: `// domain/errors/appointment.error.ts sets 'SLOT_TAKEN'
defineRoute({ method: 'POST', path: '/appointments', errors: ['FORBIDDEN', 'SLOT_ALREADY_TAKEN'], security: ['bearer'] }, book);`,
    good: `defineRoute({ method: 'POST', path: '/appointments', errors: ['FORBIDDEN', 'SLOT_TAKEN'], security: ['bearer'] }, book);`,
  },
};
