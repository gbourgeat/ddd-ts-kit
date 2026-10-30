import { describe, expect, it } from 'vitest';
import { failureCode } from '../src/streams/errors/failure-code';

/** An error reply of the server, as ioredis raises it: its text starts with the kind of the error. */
class ReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplyError';
  }
}

class InvoiceRejected extends Error {}

describe('the code of a failure', () => {
  it('is the code of the error when it carries one, else the kind the server answered, else the class', () => {
    expect(failureCode({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED redis://kit:secret@host' })).toBe(
      'ECONNREFUSED',
    );

    expect(failureCode(new ReplyError('NOGROUP No such consumer group'))).toBe('REDIS_NOGROUP');
    expect(failureCode(new ReplyError('no kind in front'))).toBe('REDIS_ERROR');
    expect(failureCode(new InvoiceRejected('the amount is negative'))).toBe('InvoiceRejected');
  });

  it('names nothing of a text, of nothing, or of an object that is not an error', () => {
    expect(failureCode('a thrown text')).toBe('UNKNOWN_ERROR');
    expect(failureCode(null)).toBe('UNKNOWN_ERROR');
    expect(failureCode({ reason: 'lost' })).toBe('UNKNOWN_ERROR');
  });
});
