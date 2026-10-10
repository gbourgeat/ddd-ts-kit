import type { Method } from './method.js';

/** The wrapper under the name and the declared parameters of what it wraps. */
export function named(wrapper: Method, original: Method): Method {
  Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true });
  Object.defineProperty(wrapper, 'length', { value: original.length, configurable: true });

  return wrapper;
}
