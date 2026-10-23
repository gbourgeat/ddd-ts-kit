import type { AdviceFactory } from '../aspect/advice-factory';
import { advised } from './advised';
import { isWrappable } from './is-wrappable';
import { shadowed } from './shadowed';
import { siteOf } from './site-of';

/**
 * Puts the advice around one method that is known to answer a promise, from its first call:
 * what a method decorator asks for.
 */
export function adviseMethod(instance: object, name: string, advise: AdviceFactory): void {
  const method: unknown = Reflect.get(instance, name);

  if (!isWrappable(method)) {
    return;
  }

  const wrapper = advised(method, { ...siteOf(instance, {}), method: name, arity: method.length }, advise);

  if (wrapper !== undefined) {
    shadowed(instance, new Map([[name, wrapper]]));
  }
}
