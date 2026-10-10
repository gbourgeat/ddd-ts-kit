import type { Method } from './method.js';

const UNTRACEABLE_CONSTRUCTORS = new Set(['GeneratorFunction', 'AsyncGeneratorFunction']);

/** Own and inherited methods, without invoking any getter. */
export function traceableMethods(instance: object, skipped: ReadonlySet<string>): Map<string, Method> {
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
