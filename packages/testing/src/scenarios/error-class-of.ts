import type { ErrorLike } from './is-error-like';

/** The class that made the error, in any realm; its name when no class did (a literal object). */
export function errorClassOf(error: ErrorLike): string {
  const made: unknown = Reflect.getPrototypeOf(error)?.constructor;

  return typeof made === 'function' && made.name !== '' && made.name !== 'Object' ? made.name : error.name;
}
