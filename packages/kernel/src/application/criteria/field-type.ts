/**
 * How the values of a field compare. `instant` is a `Date` compared by its time, `decimal` a
 * string of digits compared as a number, without the rounding of a float.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'instant' | 'decimal';
