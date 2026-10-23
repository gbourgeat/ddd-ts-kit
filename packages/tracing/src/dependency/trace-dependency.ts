import type { Attributes } from '@opentelemetry/api';
import type { DependencyKind } from '@ddd-ts-kit/kernel';
import { tracingConfiguration } from '../configuration/configure-tracing';
import { constructorName } from '../span/constructor-name';
import type { Method } from './method';
import { proxied } from './proxied';
import { shadowed } from './shadowed';
import { traceableMethods } from './traceable-methods';
import { traced } from './traced';

export interface TraceDependencyOptions {
  readonly kind: DependencyKind;
  /** Defaults to the constructor name; set it when the build minifies class names. */
  readonly className?: string;
  /** Bounded context owning the dependency. */
  readonly context?: string;
  /** Name of the port the instance is bound under: it names the spans in place of the class. */
  readonly port?: string;
}

const wrapped = new WeakSet<object>();

/**
 * Wraps the async methods of an adapter so each call is one span named
 * `<kind> <Port>.<method>` (`repository OrderRepository.save`), after the port when it is
 * known and after the class otherwise; the handler of a domain event is `handler <ClassName>`.
 * Meant for the composition root only: the wrapped class imports nothing from this package.
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
  if (wrapped.has(instance)) {
    return instance;
  }

  const wrappers = tracedMethods(instance, options);

  const result = Object.isExtensible(instance) ? shadowed(instance, wrappers) : proxied(instance, wrappers);

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

    wrappers.set(name, traced(method, spanName({ ...options, className }, name), attributes));
  }

  return wrappers;
}

function spanName(options: TraceDependencyOptions & { readonly className: string }, method: string): string {
  if (options.kind === 'domain-event-handler') {
    return method === 'handle' ? `handler ${options.className}` : `handler ${options.className}.${method}`;
  }

  return `${options.kind} ${options.port ?? options.className}.${method}`;
}

function ownClassName(instance: object): string {
  const name = constructorName(instance);

  return typeof name === 'string' ? name : 'Object';
}
