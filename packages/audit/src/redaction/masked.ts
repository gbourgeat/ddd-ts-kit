import type { MaskedField } from './masked-field.js';

export function masked<Name extends string>(field: Name): MaskedField<Name> {
  return { field, masked: true };
}
