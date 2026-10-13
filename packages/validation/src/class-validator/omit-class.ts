import type { DtoClass } from './dto-class.js';
import { derivedClass } from './derived-class.js';

/** Every property of a DTO class but `keys`, with their constraints, as a class to extend. */
export function omitClass<T extends object, K extends keyof T & string>(
  base: DtoClass<T>,
  keys: readonly K[],
): DtoClass<Omit<T, K>> {
  return derivedClass<Omit<T, K>>(
    base,
    `${base.name}_omit_${keys.join('_')}`,
    (property) => !keys.some((key) => key === property),
  );
}
