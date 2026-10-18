/** One static factory of an error class per concept, as much of it as a class of its own needs. */
export interface ConceptFactory {
  readonly name: string;
  /** Its first parameter, what the refusal is about; undefined when it has none or destructures it. */
  readonly parameter: string | undefined;
  /** The code it gives to `refusal(..)`, when that is one string literal. */
  readonly code: string | undefined;
  /** Where the method starts, its comments above included, and the offset of its closing brace. */
  readonly start: number;
  readonly end: number;
  /** The method as written, its comments above included, indented as a member. */
  readonly text: string;
  /** Why it cannot become the factory of a class of its own mechanically, when it cannot. */
  readonly manual?: string;
}

/** An error class per concept (`AppointmentError extends ConceptError`) and its factories. */
export interface ConceptErrorClass {
  readonly file: string;
  readonly context: string;
  /** For example `AppointmentError`. */
  readonly className: string;
  readonly factories: readonly ConceptFactory[];
  /** The import lines of its file: a factory may read a type or a value of another file. */
  readonly imports: readonly string[];
}
