import { describe, expect, it } from 'vitest';
import { rowOf } from '../src/contracts/read-model/row-of';

describe('the dataset of the criteria contract', () => {
  it('answers a row by its id, and refuses an id it does not hold', () => {
    expect(rowOf('a1').id).toBe('a1');
    expect(() => rowOf('z9')).toThrow('The contract dataset holds no row z9');
  });
});
