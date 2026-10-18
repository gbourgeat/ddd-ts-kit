/** One refusal on its way to a class of its own (`"stack.refusals": "named"`), and what replaces it wherever it is named. */
export interface NamedMove {
  readonly context: string;
  /** What builds it today: `SlotTakenError` (a class per error) or `AppointmentError.ended` (a factory of a concept class). */
  readonly from: string;
  /** The class it is built with today, `SlotTakenError` or `AppointmentError`. */
  readonly oldClass: string;
  /** The factory of the concept class that builds it; undefined for a class per error. */
  readonly oldFactory: string | undefined;
  /** The file it is declared in, and its path from the contexts directory without extension. */
  readonly oldFile: string;
  readonly oldPath: string;
  /** The class of its own, for example `AppointmentEnded`, and the name of its file without extension. */
  readonly className: string;
  readonly classFile: string;
  readonly factory: string;
  readonly code: string;
  /** The static factory of the class of its own, indented as a member. */
  readonly text: string;
  /** The import lines of the file it comes from: its factory may read a type of another file. */
  readonly imports: readonly string[];
}
