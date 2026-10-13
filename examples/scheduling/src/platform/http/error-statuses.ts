/**
 * The status of each business refusal that is not the default 422: an element that does not
 * exist answers 404, a request that is valid but meets the present state answers 409. One table
 * for the server and for the generated contract.
 */
export const errorStatuses: Readonly<Record<string, number>> = {
  PRACTICE_NOT_FOUND: 404,
  DELEGATION_NOT_FOUND: 404,
  PERSON_NOT_REGISTERED: 404,
  APPOINTMENT_NOT_FOUND: 404,
  NO_DOCUMENT: 404,
  UNKNOWN_CALENDAR: 404,
  UNKNOWN_CLEARANCE: 404,
  SLOT_TAKEN: 409,
  PATIENT_LIMIT_REACHED: 409,
  APPOINTMENT_ENDED: 409,
  APPOINTMENT_ALREADY_CONFIRMED: 409,
  ALREADY_WAITING: 409,
  TIME_OFF_OVER_APPOINTMENTS: 409,
  ALREADY_MEMBER: 409,
  LAST_MANAGER: 409,
  DELEGATION_ALREADY_ACTIVE: 409,
  DELEGATION_NOT_ACTIVE: 409,
};
