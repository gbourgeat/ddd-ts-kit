/** The decision about one class per error: the concept whose error class takes it, and the name of its factory. */
export interface PlannedFactory {
  /** The class to replace, for example `SlotTakenError`. */
  readonly class: string;
  readonly file: string;
  readonly code: string;
  /** The concept of the glossary, without `Error`: empty until somebody decides. */
  readonly concept: string;
  readonly factory: string;
}
