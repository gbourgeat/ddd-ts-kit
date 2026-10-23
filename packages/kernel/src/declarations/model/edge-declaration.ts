import type { Token } from '../token/token';

/**
 * A class of the edge of a context that the composition root builds like any declared class: a
 * controller, a guard, a request mapper, a serializer. The package of the transport gives the
 * word (`part`) and keeps what the class says about its route; the kernel only knows that it
 * is built from its constructor and bound under itself.
 */
export interface EdgeDeclaration {
  readonly role: 'edge';
  /** `controller`, `guard`, `mapper`, `serializer`: stable words of the transport package. */
  readonly part: string;
  readonly implementation: new (...args: never) => unknown;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
}
