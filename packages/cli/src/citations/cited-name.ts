/** What a name cited as code in a design document names: a path, a member of a class, or a class, an interface or a type. */
export type CitedKind = 'path' | 'member' | 'symbol';

/** A name a design document cites as code. */
export interface CitedName {
  /** As written, without a `:line`, `()` or type arguments after it. */
  readonly cited: string;
  readonly kind: CitedKind;
  readonly line: number;
  /** True when its sentence records that it was removed or renamed: history, not design. */
  readonly recorded: boolean;
}
