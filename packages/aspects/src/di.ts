import { compose } from './aspect.js';
import type { Aspect, AspectKind } from './types.js';

/** What the `decorate` hook of `createApplication` is told about a binding. */
export interface DecoratedBinding {
  readonly token: symbol;
  /** Name of the module that declared the binding. */
  readonly context: string;
  readonly kind?: AspectKind;
}

/**
 * The `decorate` hook of `@ddd-ts-kit/di` out of aspects, the first outermost:
 * `createApplication({ modules, decorate: aspects(logged(), timed()) })`. Every instance a
 * binding creates goes through them; what is not an object is left alone. Aspects put on one
 * binding with `.with(...)` are inside these.
 */
export function aspects(...list: readonly Aspect[]): <T>(instance: T, binding: DecoratedBinding) => T {
  const composed = compose(...list);
  return (instance, binding) => {
    if (typeof instance !== 'object' || instance === null) return instance;
    return composed(instance, {
      context: binding.context,
      ...(binding.kind === undefined ? {} : { kind: binding.kind }),
      ...(binding.token.description === undefined ? {} : { token: binding.token.description }),
    });
  };
}
