import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Lifetime } from '../wiring/lifetime';

/**
 * All the kit asks of a dependency injection container: a registry of what answers a token.
 * Everything else, the checks of the graph, the buses, the lifecycle, is the kit's own, and is the
 * same on each container. One instance per application, so that two applications, or two tests,
 * never share an object. An implementation binds under `tokenIdentity(target)`, never under the
 * class, which some containers would build when asked for it.
 */
export interface Container<Native = unknown> {
  /** The container underneath, handed out as `application.container`. */
  readonly native: Native;

  isBound(target: Token<unknown>): boolean;

  /** Binds a value. On a token already bound, this binding replaces the earlier one. */
  bindValue(target: Token<unknown>, value: unknown): void;

  /** Binds what `create` makes, once or at each resolution. An earlier binding is replaced. */
  bindFactory(target: Token<unknown>, create: () => unknown, lifetime: Lifetime): void;

  resolve<T>(target: Token<T>): T;
}
