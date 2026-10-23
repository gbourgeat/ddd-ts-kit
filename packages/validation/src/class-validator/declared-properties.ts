import { getMetadataStorage } from 'class-validator';
import type { DtoClass } from './dto-class';

/** The properties of a class, its ancestors included, that carry at least one class-validator decorator. */
export function declaredProperties(dto: DtoClass<object>): Set<string> {
  return new Set(
    getMetadataStorage()
      .getTargetValidationMetadatas(dto, '', true, false)
      .map((metadata) => metadata.propertyName),
  );
}
