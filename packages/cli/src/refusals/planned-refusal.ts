/** The decision about one refusal on its way to a class of its own: the name of that class and of its factory. */
export interface PlannedRefusal {
  /** What builds it today: `SlotTakenError` (a class per error) or `AppointmentError.ended` (a factory of a concept class). */
  readonly from: string;
  readonly file: string;
  /** Kept as it is: the code is the contract. */
  readonly code: string;
  /** The class of its own, named after the refusal: the PascalCase of its code, so that the code says it. */
  readonly class: string;
  /** Its factory, named after what the refusal is about: `forAppointment`, `withNotice`, `becauseOf`. */
  readonly factory: string;
}
