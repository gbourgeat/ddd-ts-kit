import { describeToken, type BindingAspectInfo } from '@ddd-ts-kit/kernel/declarations';
import type { Binding } from '../wiring/binding.js';

/** The instance inside the aspects of its binding, the first aspect outermost. */
export function withBindingAspects(instance: unknown, binding: Binding): unknown {
  if (binding.aspects.length === 0 || typeof instance !== 'object' || instance === null) return instance;

  const info: BindingAspectInfo = {
    className: binding.implementation ?? constructorNameOf(instance),
    context: binding.module,
    token: describeToken(binding.token),
    ...(binding.kind === undefined ? {} : { kind: binding.kind }),
  };

  return binding.aspects.reduceRight((wrapped, aspect) => aspect(wrapped, info), instance);
}

function constructorNameOf(instance: object): string {
  const prototype: unknown = Object.getPrototypeOf(instance);

  const constructor: unknown =
    typeof prototype === 'object' && prototype !== null && 'constructor' in prototype
      ? prototype.constructor
      : undefined;

  return typeof constructor === 'function' ? constructor.name : 'Object';
}
