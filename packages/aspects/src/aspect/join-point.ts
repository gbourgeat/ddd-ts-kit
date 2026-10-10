import type { AspectKind } from './aspect-kind.js';

/** One method of one instance: what a selector tests and what an advice is built for. */
export interface JoinPoint {
  readonly instance: object;
  readonly className: string;
  readonly method: string;
  /** Number of declared parameters of the method. */
  readonly arity: number;
  readonly kind?: AspectKind;
  readonly context?: string;
  readonly token?: string;
}
