import { describe, expect, it } from 'vitest';
import { argumentsOf } from '../src/nest/controllers/arguments-of';
import type { NestMethod } from '../src/nest/controllers/nest-method';

type Request = Parameters<typeof argumentsOf>[1];

const reading = (source: string, key: string): NestMethod =>
  ({ read: { parameters: [{ index: 0, source, key }] }, injected: new Map() }) as unknown as NestMethod;

describe('the arguments of a Nest controller method', () => {
  it('reads no field in a part of the request that the platform left empty', () => {
    expect(argumentsOf(reading('query', 'page'), {} as Request)).toEqual([undefined]);
  });

  it('reads a field of a part of the request that holds a list', () => {
    expect(argumentsOf(reading('body', 'length'), { body: ['a', 'b'] } as unknown as Request)).toEqual([2]);
  });
});
