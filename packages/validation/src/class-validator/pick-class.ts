import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { DtoClass } from './dto-class';
import { declaredProperties } from './declared-properties';
import { derivedClass } from './derived-class';

/**
 * The properties `keys` of a DTO class, with their constraints, as a class to extend:
 * `class RescheduleBody extends pickClass(AppointmentDto, ['startsAt', 'endsAt']) {}`.
 */
export function pickClass<T extends object, K extends keyof T & string>(
  base: DtoClass<T>,
  keys: readonly K[],
): DtoClass<Pick<T, K>> {
  const declared = declaredProperties(base);
  const undeclared = keys.filter((key) => !declared.has(key));

  if (undeclared.length > 0) {
    throw new DeclarationError(
      `${base.name} declares no constraint on ${undeclared.join(', ')}: picked, the property would be stripped as unknown. Decorate it in ${base.name} (@IsString(), @Allow(), ...).`,
    );
  }

  return derivedClass<Pick<T, K>>(base, `${base.name}_pick_${keys.join('_')}`, (property) =>
    keys.some((key) => key === property),
  );
}
