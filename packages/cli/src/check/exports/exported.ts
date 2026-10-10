/** One thing a file exports, as its declaration reads at text level. */
export interface Exported {
  /** `default` for an anonymous default export. */
  readonly name: string;
  readonly kind: 'class' | 'function' | 'interface' | 'const' | 'type' | 'enum';
  readonly line: number;
  /** The blanked code of the whole declaration. */
  readonly text: string;
  /** What others see of it: a function without its body; the whole declaration for anything else. */
  readonly signature: string;
}
