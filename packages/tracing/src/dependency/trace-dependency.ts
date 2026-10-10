import type { Attributes } from '@opentelemetry/api';
import type { DependencyKind } from '@ddd-ts-kit/kernel';
import { tracingConfiguration } from '../configuration/configure-tracing.js';
import { constructorName } from '../span/constructor-name.js';
import type { Method } from './method.js';
import { proxied } from './proxied.js';
import { shadowed } from './shadowed.js';
import { traceableMethods } from './traceable-methods.js';
import { traced } from './traced.js';

export interface TraceDependencyOptions {
  readonly kind: DependencyKind;
  /** Defaults to the constructor name; set it when the build minifies class names. */
  readonly className?: string;
  /** Bounded context owning the dependency. */
  readonly context?: string;
}

const wrapped = new WeakSet<object>();

/**
 * Wraps the async methods of an adapter so each call is one span named
 * `<kind>.<ClassName>.<method>`. Meant for the composition root only: the wrapped class
 * imports nothing from this package.
 *
 * The methods are shadowed on the instance itself, so the returned value is the same
 * object: `instanceof`, `this` and private members keep working, and wrapping twice
 * is a no-op. A span never carries arguments, results or error messages.
 *
 * A method declared `async` is traced from its first call. Any other method is traced
 * once it has been seen returning a thenable (that first call is not traced). A function
 * held in a field, `private` or not, is a method like any other.
 */
export function traceDependency<T extends object>(instance: T, options: TraceDependencyOptions): T {
  if (wrapped.has(instance)) return instance;

  const wrappers = tracedMethods(instance, options);

  const result = Object.isExtensible(instance)
    ? shadowed(instance, wrappers)
    : proxied(instance, wrappers);

  wrapped.add(result);

  return result;
}

function tracedMethods(instance: object, options: TraceDependencyOptions): Map<string, Method> {
  const className = options.className ?? ownClassName(instance);
  const skipped = new Set(tracingConfiguration().lifecycleHooks);
  const wrappers = new Map<string, Method>();

  for (const [name, method] of traceableMethods(instance, skipped)) {
    const attributes: Attributes = {
      'code.namespace': className,
      'code.function': name,
      'app.dependency.kind': options.kind,
      ...(options.context === undefined ? {} : { 'app.context': options.context }),
    };

    wrappers.set(name, traced(method, `${options.kind}.${className}.${name}`, attributes));
  }

  return wrappers;
}

function ownClassName(instance: object): string {
  const name = constructorName(instance);

  return typeof name === 'string' ? name : 'Object';
}
