import type { FieldRule } from './field-rule.js';

/** The rules of the fields of one object schema, by property name. */
export type FieldRules<T> = { readonly [Name in keyof T & string]?: FieldRule<T> };
