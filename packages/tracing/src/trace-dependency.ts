import { SpanKind, context, trace, type Attributes } from '@opentelemetry/api';
import { tracingConfiguration, type DependencyKind } from './config.js';
import { markSpanFailed } from './errors.js';
import { admitDependencySpan } from './local-root-tracker.js';
import { constructorName, isThenable, tracer } from './tracer.js';

export interface TraceDependencyOptions {
  readonly kind: DependencyKind;
  /** Defaults to the constructor name; set it when the build minifies class names. */
  readonly className?: string;
  /** Bounded context owning the dependency. */
  readonly context?: string;
}

type Method = (this: unknown, ...args: unknown[]) => unknown;

const wrapped = new WeakSet<object>();
// Shared by every instance of a class: one call returning a thenable teaches them all.
const learnedAsync = new WeakSet<Method>();

const UNTRACEABLE_CONSTRUCTORS = new Set(['GeneratorFunction', 'AsyncGeneratorFunction']);

/**
 * Wraps the async methods of an adapter so each call is one span named
 * `<kind>.<ClassName>.<method>`. Meant for the composition root only: the wrapped class
 * imports nothing from this package.
 *
 * The methods are shadowed on the instance itself, so the returned value is the same
 * object: `instanceof`, `this` and `#private` members keep working, and wrapping twice
 * is a no-op. A span never carries arguments, results or error messages.
 *
 * A method declared `async` is traced from its first call. Any other method is traced
 * once it has been seen returning a thenable (that first call is not traced).
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

export interface TraceUseCaseOptions {
  readonly context: string;
  readonly className?: string;
}

/** `traceDependency` for a command or query handler. */
export function traceUseCase<T extends object>(handler: T, options: TraceUseCaseOptions): T {
  return traceDependency(handler, { ...options, kind: 'use-case' });
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

/** Own and inherited methods, without invoking any getter. */
function traceableMethods(instance: object, skipped: ReadonlySet<string>): Map<string, Method> {
  const methods = new Map<string, Method>();
  for (const owner of prototypeChain(instance)) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      if (name === 'constructor' || skipped.has(name) || methods.has(name)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(owner, name);
      // A read-only own property cannot be shadowed, neither in place nor through a proxy.
      if (descriptor === undefined || (owner === instance && isReadOnly(descriptor))) continue;
      const candidate: unknown = descriptor.value;
      if (isTraceable(candidate)) methods.set(name, candidate);
    }
  }
  return methods;
}

function prototypeChain(instance: object): object[] {
  const chain: object[] = [];
  for (
    let owner: object | null = instance;
    owner !== null && owner !== Object.prototype && owner !== Function.prototype;
    owner = Reflect.getPrototypeOf(owner)
  ) {
    chain.push(owner);
  }
  return chain;
}

function isReadOnly(descriptor: PropertyDescriptor): boolean {
  return !descriptor.writable && !descriptor.configurable;
}

function isTraceable(value: unknown): value is Method {
  return (
    typeof value === 'function' &&
    !UNTRACEABLE_CONSTRUCTORS.has(value.constructor.name) &&
    !Function.prototype.toString.call(value).startsWith('class')
  );
}

function traced(original: Method, spanName: string, attributes: Attributes): Method {
  const declaredAsync = original.constructor.name === 'AsyncFunction';

  const wrapper: Method = function (this: unknown, ...args: unknown[]): unknown {
    const call = (): unknown => original.apply(this, args);
    if (!declaredAsync && !learnedAsync.has(original)) return learningAsync(original, call);
    if (!admitDependencySpan(spanName)) return call();
    return inSpan(call, spanName, attributes);
  };
  Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true });
  return wrapper;
}

function learningAsync(original: Method, call: () => unknown): unknown {
  const result = call();
  if (isThenable(result)) learnedAsync.add(original);
  return result;
}

function inSpan(call: () => unknown, spanName: string, attributes: Attributes): unknown {
  const parent = context.active();
  const span = tracer().startSpan(spanName, { kind: SpanKind.INTERNAL, attributes }, parent);
  let result: unknown;
  try {
    result = context.with(trace.setSpan(parent, span), call);
  } catch (error) {
    markSpanFailed(span, error);
    span.end();
    throw error;
  }
  if (!isThenable(result)) {
    span.end();
    return result;
  }
  return result.then(
    (value) => {
      span.end();
      return value;
    },
    (error: unknown) => {
      markSpanFailed(span, error);
      span.end();
      throw error;
    },
  );
}

function shadowed<T extends object>(instance: T, wrappers: ReadonlyMap<string, Method>): T {
  for (const [name, wrapper] of wrappers) {
    const own = Object.getOwnPropertyDescriptor(instance, name);
    Object.defineProperty(instance, name, {
      value: wrapper,
      writable: true,
      configurable: true,
      enumerable: own?.enumerable ?? false,
    });
  }
  return instance;
}

/**
 * A sealed or frozen instance cannot receive own methods, so it is fronted by a proxy.
 * Methods run with the real instance as `this`, otherwise `#private` members would throw.
 */
function proxied<T extends object>(instance: T, wrappers: ReadonlyMap<string, Method>): T {
  const bound = new Map<string, Method>();
  for (const [name, wrapper] of wrappers) {
    bound.set(name, function (this: unknown, ...args: unknown[]): unknown {
      return wrapper.apply(this === proxy ? instance : this, args);
    });
  }
  const proxy: T = new Proxy(instance, {
    get(target, property) {
      const method = typeof property === 'string' ? bound.get(property) : undefined;
      return method ?? Reflect.get(target, property, target);
    },
  });
  return proxy;
}
