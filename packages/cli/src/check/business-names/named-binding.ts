/** What a binding names: the reader of a message needs to know which one it is. */
export type BindingKind = 'variable' | 'loop variable' | 'destructured binding' | 'parameter' | 'property';

/** A name a source gives to something, where it is written and, when it says what it holds, what it is given. */
export interface NamedBinding {
  readonly name: string;
  readonly offset: number;
  readonly kind: BindingKind;
  /** The initializer of a variable, or the collection a loop variable walks through. */
  readonly source?: string;
}
