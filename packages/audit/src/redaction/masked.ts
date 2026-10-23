import type { MaskedField } from './masked-field';

export function masked<Name extends string>(field: Name): MaskedField<Name> {
  return { field, masked: true };
}
