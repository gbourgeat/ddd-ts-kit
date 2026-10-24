import type { MaskedField } from './masked-field';

export type AuditedField<Name extends string = string, M = unknown> = Name | MaskedField<Name, Name, M>;
