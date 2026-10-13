/** One `defineStoredEvent(Event, { ... })` of an event codec, as the text shows it. */
export interface StoredEventDeclaration {
  /** The key it is declared under, the name the event carries; `undefined` when the key is not a string literal. */
  readonly name: string | undefined;
  readonly eventClass: string;
  readonly line: number;
  /** `undefined` when `version` is not a number literal. */
  readonly version: number | undefined;
  /** The versions an upcaster reads, as the keys of `upcasters` say. */
  readonly upcasters: readonly number[];
  /** The type `encode` answers, by name; `undefined` when its signature names none. */
  readonly payloadType: string | undefined;
  /** The fingerprint of that type as declared in the same file; `undefined` when it is not declared there. */
  readonly fingerprint: string | undefined;
  /** The named types that data reaches and the file does not declare: a change of theirs would not move the fingerprint. */
  readonly unresolved: readonly string[];
}
