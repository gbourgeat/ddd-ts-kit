/** The methods of the value objects of a project that returned a `Result` and now return the value or throw. */
export interface ResultMethods {
  /** `Class.method`, for the static factories: `Email.create`. */
  readonly statics: ReadonlySet<string>;
  /** The names of the instance methods: `movedTo`. */
  readonly instance: ReadonlySet<string>;
}
