import { isOneOf } from './is-one-of';
import { VALIDATION_STACKS, type ValidationStack } from './stack';

/** The packages a schema is written with, by the validation library of the stack. */
const SCHEMA_LIBRARIES: Readonly<Record<ValidationStack, readonly string[]>> = {
  zod: ['zod'],
  'class-validator': ['class-validator', 'class-transformer'],
  typebox: ['typebox'],
  'standard-schema': [],
  none: [],
};

/**
 * An integration event and a background job declare a schema of their payload: what the
 * published language and the file of a background job may import of the library of the stack.
 */
export function schemaLibrariesOf(validation: string): readonly string[] {
  return isOneOf(VALIDATION_STACKS, validation) ? SCHEMA_LIBRARIES[validation] : [];
}
