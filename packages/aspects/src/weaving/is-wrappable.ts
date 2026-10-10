import type { Method } from './method.js';

const UNWRAPPABLE_CONSTRUCTORS = new Set(['GeneratorFunction', 'AsyncGeneratorFunction']);

export function isWrappable(value: unknown): value is Method {
  return typeof value === 'function' && !UNWRAPPABLE_CONSTRUCTORS.has(value.constructor.name) && !Function.prototype.toString.call(value).startsWith('class');
}
