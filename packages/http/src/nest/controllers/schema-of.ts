import type { Schema } from '@ddd-ts-kit/validation';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { DtoType } from './dto-type';
import type { NestControllerRoutesOptions } from './nest-controller-routes-options';

/** A schema as it is given, or the one `schemaOfClass` reads from a DTO class. */
export function schemaOf(
  where: string,
  described: Schema<unknown> | DtoType,
  { schemaOfClass }: NestControllerRoutesOptions,
): Schema<unknown> {
  if (typeof described !== 'function') {
    return described;
  }

  if (schemaOfClass === undefined) {
    throw new DeclarationError(
      `${where} is described by the class ${described.name}, and nothing reads it: give schemaOfClass (classSchema of @ddd-ts-kit/validation/class-validator).`,
    );
  }

  return schemaOfClass(described);
}
