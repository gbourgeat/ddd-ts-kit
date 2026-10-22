import { IsOptional } from 'class-validator';
import type { DtoClass } from './dto-class';
import { declaredProperties } from './declared-properties';
import { derivedClass } from './derived-class';
import { prototypeOf } from './prototype-of';

/**
 * Every property of a DTO class, each optional and checked by its constraints when present, as
 * a class to extend: the body of a partial update, `class EditBody extends partialClass(PatientDto) {}`.
 */
export function partialClass<T extends object>(base: DtoClass<T>): DtoClass<Partial<T>> {
  const partial = derivedClass<Partial<T>>(base, `${base.name}_partial`, () => true);
  const optional = IsOptional();

  for (const property of declaredProperties(base)) {
    optional(prototypeOf(partial), property);
  }

  return partial;
}
