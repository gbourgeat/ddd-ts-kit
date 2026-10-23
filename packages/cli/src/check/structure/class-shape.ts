import type { MethodShape } from './method-shape';

export interface ClassShape {
  readonly name: string;
  readonly line: number;
  readonly start: number;
  /** Offsets of the braces around the body. */
  readonly bodyStart: number;
  readonly end: number;
  /** Brace depth of the declaration: 0 for a class of the module. */
  readonly depth: number;
  readonly isExported: boolean;
  readonly isAbstract: boolean;
  readonly superclass: string | undefined;
  /** The names after `implements`, without their type arguments. */
  readonly implemented: readonly string[];
  /** The members that have a body. */
  readonly methods: readonly MethodShape[];
}
