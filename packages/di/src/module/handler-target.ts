import type { Dependencies, DependencyList, DependencyTokens } from '@ddd-ts-kit/kernel/declarations';
import type { Resolve } from '../wiring/resolve.js';

export interface HandlerTarget<Handler> {
  /**
   * Binds the class as a singleton, under itself; its constructor arguments are the listed
   * ports. One class is one binding: a class given to two statements is refused.
   */
  handledBy<Args extends readonly unknown[], const List extends Dependencies = DependencyTokens<Args>>(
    handler: new (...args: Args) => Handler,
    ...dependencies: DependencyList<Args, List>
  ): void;

  handledByFactory(factory: (resolve: Resolve) => Handler): void;
}
