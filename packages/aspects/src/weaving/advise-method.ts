import type { AdviceFactory } from '../aspect/advice-factory.js';
import { advised } from './advised.js';
import { isWrappable } from './is-wrappable.js';
import { shadowed } from './shadowed.js';
import { siteOf } from './site-of.js';

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
