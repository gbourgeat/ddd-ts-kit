import type { AdviceFactory } from '../aspect/advice-factory.js';
import type { AspectInfo } from '../aspect/aspect-info.js';
import { advised } from './advised.js';
import { fromOutside } from './from-outside.js';
import { isWrappable } from './is-wrappable.js';
import { knownAsync } from './known-async.js';
import { LIFECYCLE_HOOKS } from './lifecycle-hooks.js';
import type { Method } from './method.js';
import { named } from './named.js';
import { shadowed } from './shadowed.js';
import { siteOf } from './site-of.js';

// A function standing in for another is asynchronous when the other is.
const standsFor = new WeakMap<Method, Method>();

/**
 * Puts the advice around the calls that reach the instance from outside, on every asynchronous
 * method. Public cannot be told from `private` once compiled, so every method is wrapped; what
 * tells the calls apart is where they come from: a call the instance makes on itself while one
 * of its advised calls is running is not advised again. A method declared `async` is advised
 * from its first call; a method that merely returns a promise is advised from its second call
 * (the first one teaches that it is asynchronous). Synchronous methods, getters, symbols,
 * generators and lifecycle hooks are left alone.
 */
export function adviseMethods<T extends object>(instance: T, info: AspectInfo, advise: AdviceFactory): T {
  const wrappers = new Map<string, Method>();
  const site = siteOf(instance, info);
  const application = {};

  for (const [name, method] of wrappableMethods(instance)) {
    const wrapper = advised(method, { ...site, method: name, arity: method.length }, advise);

    if (wrapper !== undefined) {
      wrappers.set(name, learning(method, fromOutside(method, wrapper, application)));
    }
  }

  if (wrappers.size === 0) {
    return instance;
  }

  return Object.isExtensible(instance) ? shadowed(instance, wrappers) : proxied(instance, wrappers);
}

/** Own and inherited methods as they are reached now, without invoking any getter. */
function wrappableMethods(instance: object): Map<string, Method> {
  const methods = new Map<string, Method>();
  const seen = new Set<string>(['constructor', ...LIFECYCLE_HOOKS]);

  for (const owner of prototypeChain(instance)) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      if (seen.has(name)) {
        continue;
      }

      seen.add(name);

      if (!holdsShadowableMethod(owner, name, instance)) {
        continue;
      }

      // Read through the instance: a proxy put by another aspect answers its own wrapper.
      const current: unknown = Reflect.get(instance, name);

      if (isWrappable(current)) {
        methods.set(name, current);
      }
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

/** A read-only own property cannot be shadowed, neither in place nor through a proxy. */
function holdsShadowableMethod(owner: object, name: string, instance: object): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(owner, name);

  if (descriptor === undefined || (owner === instance && isReadOnly(descriptor))) {
    return false;
  }

  return typeof descriptor.value === 'function';
}

function isReadOnly(descriptor: PropertyDescriptor): boolean {
  return !descriptor.writable && !descriptor.configurable;
}

function learning(original: Method, wrapper: Method): Method {
  if (isAsync(original)) {
    return wrapper;
  }

  const learner: Method = function (this: unknown, ...args: unknown[]): unknown {
    if (isAsync(original)) {
      return wrapper.apply(this, args);
    }

    const result = original.apply(this, args);

    if (isThenable(result)) {
      knownAsync.add(original);
    }

    return result;
  };

  standsFor.set(learner, original);

  return named(learner, original);
}

function isAsync(method: Method): boolean {
  if (method.constructor.name === 'AsyncFunction' || knownAsync.has(method)) {
    return true;
  }

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

/**
 * A sealed or frozen instance cannot receive own methods, so it is fronted by a proxy that
 * answers the wrappers. A method runs with the proxy as `this`, as it would with the instance
 * itself: a method it calls through `this` meets the same wrappers, and its fields are read
 * through.
 */
function proxied<T extends object>(instance: T, wrappers: ReadonlyMap<string, Method>): T {
  return new Proxy(instance, {
    get(target, property, receiver: unknown) {
      const wrapper = typeof property === 'string' ? wrappers.get(property) : undefined;

      return wrapper ?? Reflect.get(target, property, receiver);
    },
  });
}
