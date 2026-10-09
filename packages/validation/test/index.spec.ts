import { describe, expect, it } from 'vitest';
import { DomainError, err, ok } from '@ddd-ts-kit/kernel';
import {
  ValidationError,
  customSchema,
  formatPath,
  parseOrThrow,
  type Infer,
} from '../src/index.js';

const positive = customSchema<number>(
  (input) =>
    typeof input === 'number' && input > 0
      ? ok(input)
      : err([{ path: '', code: 'positive', message: 'A positive number is expected.' }]),
  { type: 'number', exclusiveMinimum: 0 },
);

describe('the Schema port', () => {
  it('returns the parsed value when the input is valid', () => {
    const value: Infer<typeof positive> = parseOrThrow(positive, 3);
    expect(value).toBe(3);
  });

  it('throws a domain error carrying the issues when the input is not valid', () => {
    let caught: unknown;
    try {
      parseOrThrow(positive, -1);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught).toMatchObject({
      code: 'VALIDATION_FAILED',
      issues: [{ path: '', code: 'positive' }],
    });
  });

  it('exposes the JSON Schema given to a custom schema', () => {
    expect(positive.toJsonSchema()).toEqual({ type: 'number', exclusiveMinimum: 0 });
  });

  it('reports paths in dotted form', () => {
    expect(formatPath(['items', 0, 'sku'])).toBe('items.0.sku');
    expect(formatPath([])).toBe('');
  });
});
