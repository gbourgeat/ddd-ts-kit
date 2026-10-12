/** A `defineRoute` function as its file writes it, cut into what a controller is made of. */
export interface FunctionRoute {
  /** The file, relative to the project root. */
  readonly file: string;
  /** `book-appointment`, from `book-appointment.route.ts`. */
  readonly kebab: string;
  /** `BookAppointment`. */
  readonly pascal: string;
  /** The name and the type of the bus the function takes: `commands`, `CommandBus`. */
  readonly bus: string;
  readonly busType: string;
  readonly imports: readonly string[];
  /** What stands between the imports and the function: schemas, constants, their comments. */
  readonly prelude: string;
  /** The entries of the declaration, by key, as written. */
  readonly spec: ReadonlyMap<string, string>;
  /** The name of the parameter of the handler, and the statements of its body. */
  readonly input: string;
  readonly body: string;
  /** What stands after the function: the helpers it calls. */
  readonly trailer: string;
}
