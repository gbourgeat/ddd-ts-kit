import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { DtoClass } from './dto-class';
import { copyClassMetadata } from './copy-class-metadata';
import { declaredProperties } from './declared-properties';

/**
 * A new class, named `name`, that validates and documents the properties of `base` that `keeps`
 * accepts, and nothing else. It is meant to be extended by a class of the presentation layer,
 * which gives it its name in the contract: `class CancelBody extends pickClass(...) {}`.
 */
export function derivedClass<T extends object>(
  base: DtoClass<object>,
  name: string,
  keeps: (property: string) => boolean,
): DtoClass<T> {
  const derived = class {};

  // Two derived classes of one name would merge in class-validator-jsonschema, which groups by name.
  Object.defineProperty(derived, 'name', { value: name });

  const copied = copyClassMetadata(base, derived, keeps);

  if (!validatesAs<T>(derived, copied)) {
    throw new DeclarationError(
      `${name} keeps no property of ${base.name} that carries a constraint: there is nothing to validate.`,
    );
  }

  return derived;
}

/** True once the class carries a constraint for some property, and for every one copied: it then parses into a `T`. */
function validatesAs<T extends object>(derived: DtoClass<object>, copied: readonly string[]): derived is DtoClass<T> {
  const declared = declaredProperties(derived);

  return copied.length > 0 && copied.every((property) => declared.has(property));
}
