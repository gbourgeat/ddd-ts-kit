import type { Decoration } from './decoration';

export interface DeclaredClass {
  readonly name: string;
  readonly line: number;
  /** Offset of the `class` keyword. */
  readonly start: number;
  readonly exported: boolean;
  /** The declaration decorators the class carries, in source order. */
  readonly decorations: readonly Decoration[];
}
