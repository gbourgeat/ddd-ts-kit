import { describe, expect, it } from 'vitest';
import { payloadShapeOf } from '../src/generate/kinds/background/payload-shape';

describe('the shape of a field of a background job payload, read from the type the command writes', () => {
  it('reads a primitive, a list of them in each spelling, and a union of quoted literals, `undefined` aside', () => {
    expect(
      [
        'string',
        'number | undefined',
        'readonly boolean[]',
        'Array<string>',
        'ReadonlyArray<number>',
        '\'mail\' | "sms"',
      ].map(payloadShapeOf),
    ).toEqual([
      { kind: 'string' },
      { kind: 'number' },
      { kind: 'list', of: 'boolean' },
      { kind: 'list', of: 'string' },
      { kind: 'list', of: 'number' },
      { kind: 'literals', values: ['mail', 'sms'] },
    ]);
  });

  it('leaves unread what the schema cannot check from its text: null, a number literal, a list of literals', () => {
    expect(['string | null', '1 | 2', "readonly ('a' | 'b')[]"].map(payloadShapeOf)).toEqual([
      { kind: 'unread', type: 'string | null' },
      { kind: 'unread', type: '1 | 2' },
      { kind: 'unread', type: "readonly ('a' | 'b')[]" },
    ]);
  });
});
