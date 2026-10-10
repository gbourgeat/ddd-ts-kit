import type { FieldValue } from './field-value.js';

/**
 * The fields of a read model a criteria may name: those that hold a scalar. A property that
 * holds an object, such as one added by hydration, is not one of them.
 */
export type FieldOf<Row> = {
  [Key in keyof Row & string]-?: [NonNullable<Row[Key]>] extends [FieldValue] ? Key : never;
}[keyof Row & string];
