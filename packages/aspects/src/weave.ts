import type { AdviceFactory, AspectInfo, JoinPoint } from './types.js';

type Method = (this: unknown, ...args: unknown[]) => unknown;

/** Method names never wrapped: frameworks call them outside of any unit of work. */
export const LIFECYCLE_HOOKS: readonly string[] = [
  'onModuleInit',
  'onModuleDestroy',
  'onApplicationBootstrap',
  'onApplicationShutdown',
  'dispose',
];

const UNWRAPPABLE_CONSTRUCTORS = new Set(['GeneratorFunction', 'AsyncGeneratorFunction']);

// Shared by every instance of a class: one call returning a thenable teaches them all.
const knownAsync = new WeakSet<Method>();
// A function standing in for another is asynchronous when the other is.
const standsFor = new WeakMap<Method, Method>();

/**
 * Puts the advice around every asynchronous method of the instance. A method declared `async`
 * is advised from its first call; a method that merely returns a promise is advised from its
 * second call (the first one teaches that it is asynchronous). Synchronous methods, getters,
 * symbols, `#private` members, generators and lifecycle hooks are left alone.
 */
export function adviseMethods<T extends object>(instance: T, info: AspectInfo, advise: AdviceFactory): T {
  const wrappers = new Map<string, Method>();
  const site = siteOf(instance, info);
  for (const [name, method] of wrappableMethods(instance)) {
    const wrapper = advised(method, { ...site, method: name, arity: method.length }, advise);
    if (wrapper !== undefined) wrappers.set(name, learning(method, wrapper));
  }
  if (wrappers.size === 0) return instance;
  return Object.isExtensible(instance) ? shadowed(instance, wrappers) : proxied(instance, wrappers);
}

/**
 * Puts the advice around one method that is known to answer a promise, from its first call:
 * what a method decorator asks for.
 */
export function adviseMethod(instance: object, name: string, advise: AdviceFactory): void {
  const method: unknown = Reflect.get(instance, name);
  if (!isWrappable(method)) return;
  const wrapper = advised(method, { ...siteOf(instance, {}), method: name, arity: method.length }, advise);
  if (wrapper !== undefined) shadowed(instance, new Map([[name, wrapper]]));
}

/**
 * The same advice for a method decorated in the legacy mode, which has no initializer to run
 * at construction: the answer replaces the method on the prototype, and builds the advice of
 * each instance at its first call. State is kept per instance and per method, as above.
 */
export function advisePrototypeMethod(name: string, original: unknown, advise: AdviceFactory): unknown {
  if (!isWrappable(original)) return original;
  const wrappers = new WeakMap<object, Method>();
  const dispatcher: Method = function (this: unknown, ...args: unknown[]): unknown {
    if (typeof this !== 'object' || this === null) return original.apply(this, args);
    const wrapper = wrappers.get(this) ?? adviceOf(this, original, { name, advise });
    wrappers.set(this, wrapper);
    return wrapper.apply(this, args);
  };
  knownAsync.add(dispatcher);
  return named(dispatcher, original);
}

interface Advising {
  readonly name: string;
  readonly advise: AdviceFactory;
}

function adviceOf(instance: object, original: Method, { name, advise }: Advising): Method {
  return advised(original, { ...siteOf(instance, {}), method: name, arity: original.length }, advise) ?? original;
}

/** Own and inherited methods as they are reached now, without invoking any getter. */
function wrappableMethods(instance: object): Map<string, Method> {
  const methods = new Map<string, Method>();
  const seen = new Set<string>(['constructor', ...LIFECYCLE_HOOKS]);
  for (const owner of prototypeChain(instance)) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      if (seen.has(name)) continue;
      seen.add(name);
      const descriptor = Object.getOwnPropertyDescriptor(owner, name);
      // A read-only own property cannot be shadowed, neither in place nor through a proxy.
      if (descriptor === undefined || (owner === instance && isReadOnly(descriptor))) continue;
      if (typeof descriptor.value !== 'function') continue;
      // Read through the instance: a proxy put by another aspect answers its own wrapper.
      const current: unknown = Reflect.get(instance, name);
      if (isWrappable(current)) methods.set(name, current);
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

function isWrappable(value: unknown): value is Method {
  return (
    typeof value === 'function' &&
    !UNWRAPPABLE_CONSTRUCTORS.has(value.constructor.name) &&
    !Function.prototype.toString.call(value).startsWith('class')
  );
}

function siteOf(instance: object, info: AspectInfo): Omit<JoinPoint, 'method' | 'arity'> {
  return {
    instance,
    className: info.className ?? constructorNameOf(instance),
    ...(info.kind === undefined ? {} : { kind: info.kind }),
    ...(info.context === undefined ? {} : { context: info.context }),
    ...(info.token === undefined ? {} : { token: info.token }),
  };
}

function constructorNameOf(instance: object): string {
  const constructor: unknown = Reflect.get(instance, 'constructor');
  return typeof constructor === 'function' && constructor.name !== '' ? constructor.name : 'Object';
}

function advised(original: Method, joinPoint: JoinPoint, advise: AdviceFactory): Method | undefined {
  const advice = advise(joinPoint);
  if (advice === undefined) return undefined;
  // Async so that an advice failing before its first await rejects the call instead of throwing.
  const wrapper: Method = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
    return advice({
      args,
      proceed: async (next = args) => original.apply(this, [...next]),
    });
  };
  knownAsync.add(wrapper);
  return named(wrapper, original);
}

function learning(original: Method, wrapper: Method): Method {
  if (isAsync(original)) return wrapper;
  const learner: Method = function (this: unknown, ...args: unknown[]): unknown {
    if (isAsync(original)) return wrapper.apply(this, args);
    const result = original.apply(this, args);
    if (isThenable(result)) knownAsync.add(original);
    return result;
  };
  standsFor.set(learner, original);
  return named(learner, original);
}

function isAsync(method: Method): boolean {
  if (method.constructor.name === 'AsyncFunction' || knownAsync.has(method)) return true;
  const other = standsFor.get(method);
  return other !== undefined && isAsync(other);
}

function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

function named(wrapper: Method, original: Method): Method {
  Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true });
  Object.defineProperty(wrapper, 'length', { value: original.length, configurable: true });
  return wrapper;
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
    const binding: Method = function (this: unknown, ...args: unknown[]): unknown {
      return wrapper.apply(this === proxy ? instance : this, args);
    };
    standsFor.set(binding, wrapper);
    bound.set(name, named(binding, wrapper));
  }
  const proxy: T = new Proxy(instance, {
    get(target, property) {
      const method = typeof property === 'string' ? bound.get(property) : undefined;
      return method ?? Reflect.get(target, property, target);
    },
  });
  return proxy;
}
