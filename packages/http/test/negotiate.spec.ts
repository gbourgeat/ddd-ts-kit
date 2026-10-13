import { describe, expect, it } from 'vitest';
import { negotiate } from '../src/index.js';

const OFFERED = ['application/json', 'application/xml', 'text/csv'];

describe('content negotiation on Accept', () => {
  it.each([
    [undefined, 'application/json'],
    ['', 'application/json'],
    ['*/*', 'application/json'],
    ['text/*', 'text/csv'],
    ['application/xml', 'application/xml'],
    ['application/xml;q=0.4, text/csv;q=0.9', 'text/csv'],
    ['application/*;q=0.5, application/xml', 'application/xml'],
    ['application/xml;q=0, */*;q=0.1', 'application/json'],
    ['TEXT/CSV', 'text/csv'],
    ['application/json, application/xml', 'application/json'],
    ['nonsense, text/csv;q=oops, application/xml', 'application/xml'],
  ])('answers %s with %s', (accept, expected) => {
    expect(negotiate(accept, OFFERED)).toBe(expected);
  });

  it.each([['image/png'], ['application/xml;q=0'], ['text/csv;q=0, application/*;q=0']])(
    'finds nothing acceptable in %s',
    (accept) => {
      expect(negotiate(accept, OFFERED)).toBeUndefined();
    },
  );
});
