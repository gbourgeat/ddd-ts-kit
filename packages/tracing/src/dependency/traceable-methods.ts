import type { Method } from './method.js';

const UNTRACEABLE_CONSTRUCTORS = new Set(['GeneratorFunction', 'AsyncGeneratorFunction']);

/** Own and inherited methods, without invoking any getter. */
export function traceableMethods(instance: object, skipped: ReadonlySet<string>): Map<string, Method> {
  const methods = new Map<string, Method>();

  for (const owner of prototypeChain(instance)) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      if (name === 'constructor' || skipped.has(name) || methods.has(name)) {
        continue;
      }

      const candidate = methodHeld(owner, name, instance);

      if (isTraceable(candidate)) {
        methods.set(name, candidate);
      }
    }
  }

  return methods;
}

/** What the instance answers for a name its owner holds a function under, `undefined` for anything else. */
function methodHeld(owner: object, name: string, instance: object): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(owner, name);

  // A read-only own property cannot be shadowed, neither in place nor through a proxy.
  if (descriptor === undefined || (owner === instance && isReadOnly(descriptor))) {
    return undefined;
  }

  if (typeof descriptor.value !== 'function') {
    return undefined;
  }

  // Read through the instance: a proxy put in front of it by an aspect answers its own wrapper.
  return Reflect.get(instance, name);
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
