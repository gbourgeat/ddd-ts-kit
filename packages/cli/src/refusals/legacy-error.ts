/** One parameter of the constructor of a class per error, modifiers removed. */
export interface LegacyParameter {
  readonly name: string;
  /** As written after the colon, or `unknown` when the parameter has no type. */
  readonly type: string;
}

/** A class per error of 0.2, as much of it as a factory needs. */
export interface LegacyError {
  readonly file: string;
  readonly context: string;
  readonly className: string;
  readonly code: string;
  readonly parameters: readonly LegacyParameter[];
  /** The parameters that were also properties of the error (`readonly personId: string`): the facts carry them now. */
  readonly properties: readonly string[];
  /** The expression given to `super(..)`, as written. */
  readonly message: string;
  /** Why the class cannot be turned into a factory mechanically, when it cannot. */
  readonly manual?: string;
}
