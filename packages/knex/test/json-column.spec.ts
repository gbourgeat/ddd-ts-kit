import { describe, expect, it } from 'vitest';
import { jsonColumn } from '../src';

describe('jsonColumn', () => {
  it('answers the JSON text of an object, a list and a string, which a jsonb parameter reads back as it was', () => {
    expect(jsonColumn({ a: 1 })).toBe('{"a":1}');
    expect(jsonColumn([1, { a: 2 }])).toBe('[1,{"a":2}]');
    expect(jsonColumn('plain')).toBe('"plain"');
  });

  it('answers the JSON null for null and for an absent value', () => {
    expect(jsonColumn(null)).toBe('null');
    expect(jsonColumn(undefined)).toBe('null');
  });
});
