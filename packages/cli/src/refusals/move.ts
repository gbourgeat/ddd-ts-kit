/** One class per error on its way to a factory: what replaces it wherever it is named. */
export interface Move {
  /** The class that disappears, for example `SlotTakenError`. */
  readonly className: string;
  /** The error class of the concept, for example `AppointmentError`. */
  readonly conceptClass: string;
  /** The file name of that class without its extension, for example `appointment.error`. */
  readonly conceptFile: string;
  readonly factory: string;
  /** The context the class belongs to, and the path of its file from the contexts directory, without extension. */
  readonly context: string;
  readonly legacyPath: string;
  readonly code: string;
}
