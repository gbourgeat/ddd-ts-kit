import type { MaskedField } from './masked-field.js';

export type AuditedField<Name extends string = string> = Name | MaskedField<Name>;
