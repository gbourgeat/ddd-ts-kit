import { describe, expect, it } from 'vitest';
import { errorOutlineOf } from '../src/contracts/logger/error-outline-of';

describe('the outline of an error as a logger wrote it', () => {
  it('tells a stack led by the class and the message from one of frames alone, and sees none without a stack', () => {
    const frames = '    at weigh (parcel.ts:12:5)';
    const titled = `RangeError: weight out of range\n${frames}`;

    expect(errorOutlineOf({ type: 'RangeError', message: 'weight out of range', stack: titled })?.stack).toBe('titled');
    expect(errorOutlineOf({ type: 'Error', message: 'x', stack: frames })?.stack).toBe('frames');
    expect(errorOutlineOf({ type: 'Error', message: 'x', stack: 'Error: another message' })?.stack).toBe('none');
    expect(errorOutlineOf({ type: 'Error', message: 'x' })?.stack).toBe('none');
  });

  it('follows the causes, and is nothing for a field that does not describe an error', () => {
    const written = {
      type: 'Error',
      code: 'PARCEL_LOST',
      message: 'lost',
      cause: { type: 'TypeError', message: 'socket' },
    };

    expect(errorOutlineOf(written)).toEqual({
      type: 'Error',
      code: 'PARCEL_LOST',
      message: 'lost',
      stack: 'none',
      cause: { type: 'TypeError', code: undefined, message: 'socket', stack: 'none', cause: undefined },
    });

    expect(errorOutlineOf('lost')).toBeUndefined();
    expect(errorOutlineOf({ message: 'lost' })).toBeUndefined();
  });
});
