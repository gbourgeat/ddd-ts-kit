import { describeToken, type BindingAspect, type BindingAspectInfo } from '@ddd-ts-kit/kernel/declarations';
import type { Binding } from '../wiring/binding.js';

/**
 * The instance inside the aspects of its binding, then inside the ones the modules put around
 * its kind: of each list, the first aspect is outermost.
 */
export function withBindingAspects(instance: unknown, binding: Binding, aroundKind: readonly BindingAspect[]): unknown {
  const aspects = [...aroundKind, ...binding.aspects];

  if (aspects.length === 0 || typeof instance !== 'object' || instance === null) {
    return instance;
  }

  const info: BindingAspectInfo = {
    className: binding.implementation ?? constructorNameOf(instance),
    context: binding.module,
    token: describeToken(binding.token),
    ...(binding.kind === undefined ? {} : { kind: binding.kind }),
  };

  return aspects.reduceRight((wrapped, aspect) => aspect(wrapped, info), instance);
}

function constructorNameOf(instance: object): string {
  const prototype: unknown = Object.getPrototypeOf(instance);

  const constructor: unknown =
    typeof prototype === 'object' && prototype !== null && 'constructor' in prototype
      ? prototype.constructor
      : undefined;

  return typeof constructor === 'function' ? constructor.name : 'Object';
}
