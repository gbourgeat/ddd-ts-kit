import type { MaskedField } from './masked-field';

export type AuditedField<Name extends string = string> = Name | MaskedField<Name>;
