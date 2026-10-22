import type { FieldType } from './field-type';

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/** Whether a value is one a field of the type holds, and compares with. */
export function isValueOf(type: FieldType, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'instant':
      return value instanceof Date && !Number.isNaN(value.getTime());
    case 'decimal':
      return typeof value === 'string' && DECIMAL.test(value);
  }
}
