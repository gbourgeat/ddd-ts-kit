import type { RuleDoc } from '../model/rule-doc.js';

export const ERRORS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'errors/code-unique': {
    why: 'The code is the identity of a refusal for everything outside the domain: the HTTP mapper gives it a status, the OpenAPI document lists it, the audit trail and the span record it as the reason, a client branches on it and a test asserts it. Nothing downstream knows the class or the factory. Two refusals of one context under one code are therefore one refusal for every reader, whatever their messages say. The code is checked per context, since each context owns its language: the same code in two contexts is allowed, and the error mapper of the application gives it one status. Both forms are read, the first argument of `refusal(..)` in a factory and the `readonly code` field of a class per error. Judged under "stack.refusals": "factories" only: a project whose config does not say was written when an error was a class, and keeps working untouched.',
    bad: `export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string) {
    return AppointmentError.refusal('BOOKING_REFUSED', 'The slot is already held.', { calendarId });
  }

  static outsideAvailability(startsAt: Date) {
    return AppointmentError.refusal('BOOKING_REFUSED', 'The calendar takes no appointment then.', { startsAt });
  }
}`,
    good: `export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string) {
    return AppointmentError.refusal('SLOT_TAKEN', 'The slot is already held.', { calendarId });
  }

  static outsideAvailability(startsAt: Date) {
    return AppointmentError.refusal('OUTSIDE_AVAILABILITY', 'The calendar takes no appointment then.', { startsAt });
  }
}`,
  },
  'errors/known-code': {
    why: 'The `errors` list of a route is what the OpenAPI document promises: one problem response per status of the codes it names. A code written there that no refusal sets, misspelled or left behind by a renamed factory, is a response the contract documents and the API never gives, while the refusal really raised is missing from it. A code exists when a factory or an error class of the context of the route sets it, when a class outside the contexts (the platform, the shared kernel) does, or when it is a code of the kit: VALIDATION_FAILED, NOT_FOUND, CONFLICT, INVARIANT_VIOLATION, UNAUTHORIZED, FORBIDDEN, NOT_ACCEPTABLE, CONCURRENCY_CONFLICT, INVALID_CRITERIA, INVALID_PAGE_REQUEST, TIMEOUT, CIRCUIT_OPEN, BULKHEAD_FULL, ATTEMPTS_EXHAUSTED, and the refusals of a file: FILE_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, FILE_NOT_FOUND, FILE_REJECTED, INVALID_FILE_KEY. A code another context sets does not count: a context answers with its own language. Judged under "stack.refusals": "factories" only.',
    bad: `// domain/errors/appointment.error.ts sets 'SLOT_TAKEN'
defineRoute({ method: 'POST', path: '/appointments', errors: ['FORBIDDEN', 'SLOT_ALREADY_TAKEN'], security: ['bearer'] }, book);`,
    good: `defineRoute({ method: 'POST', path: '/appointments', errors: ['FORBIDDEN', 'SLOT_TAKEN'], security: ['bearer'] }, book);`,
  },
};
