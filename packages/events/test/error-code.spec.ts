import { describe, expect, it } from 'vitest';
import { errorCode } from '../src';

class BrokerDown extends Error {
  constructor() {
    super('connection refused to amqp://user:secret@broker');
  }
}

describe('errorCode', () => {
  it.each([
    [Object.assign(new Error('boom'), { code: 'ECONNREFUSED' }), 'ECONNREFUSED'],
    [Object.assign(new Error('boom'), { code: 'not a code: it quotes data' }), 'Error'],
    [new BrokerDown(), 'BrokerDown'],
    [new AggregateError([], 'two handlers failed'), 'AggregateError'],
    ['a thrown string', 'UNKNOWN_ERROR'],
    [{ message: 'not an error' }, 'UNKNOWN_ERROR'],
    [undefined, 'UNKNOWN_ERROR'],
  ])('reduces %o to an identifier', (error, code) => {
    expect(errorCode(error)).toBe(code);
  });
});
