import type { Dependencies, DependencyList, DependencyTokens } from '@ddd-ts-kit/kernel/declarations';
import type { Resolve } from '../wiring/resolve.js';
import type { BindingOptions } from './binding-options.js';
import type { ValueBindingOptions } from './value-binding-options.js';

export interface BindingTarget<T> {
  /**
   * The class needs no decorator: its constructor arguments are the listed ports, in order.
   * It implements the port it is bound to and never extends it.
   */
  toClass<Args extends readonly unknown[], const List extends Dependencies = DependencyTokens<Args>>(
    implementation: new (...args: Args) => T,
    ...dependencies: DependencyList<Args, List>
  ): BindingOptions;

  toFactory(factory: (resolve: Resolve) => T): BindingOptions;

  /** A fake, a plain object of the shape of the port, or the value an abstract class types. */
  toValue(value: T): ValueBindingOptions;
}
