import { describe, expect, expectTypeOf, it } from 'vitest';
import { ConceptError, DomainError, InvariantViolation, isRefusal, unwrap, err, type CodeOf } from '../src';
import { BookingError } from './support/booking-error';

class WaitlistError extends ConceptError {
  static alreadyWaiting(patientId: string) {
    return WaitlistError.refusal('ALREADY_WAITING', `The patient ${patientId} already waits.`, { patientId });
  }
}

class LegacyError extends DomainError {
  readonly code = 'LEGACY';
}

const startsAt = new Date('2026-03-02T09:00:00.000Z');

function describeRefusal(error: unknown): string {
  if (!BookingError.is(error)) {
    return 'not a booking refusal';
  }

  switch (error.code) {
    case 'SLOT_TAKEN':
      return `taken at ${error.facts.startsAt.toISOString()}`;
    case 'BOOKING_TOO_LATE':
      return `notice ${error.facts.notice}`;
    case 'REASON_REQUIRED':
    case 'STORE_UNREACHABLE':
      return error.code;
  }
}

describe('ConceptError', () => {
  it('builds a refusal through a factory: a DomainError of its class, with the code and the message', () => {
    const error = BookingError.slotTaken('cal-1', startsAt);

    expect(error).toBeInstanceOf(BookingError);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BookingError');
    expect(error.code).toBe('SLOT_TAKEN');
    expect(error.message).toBe('The slot at 2026-03-02T09:00:00.000Z on cal-1 is held.');
    expect(error.stack).toContain('BookingError');
  });

  it('carries the facts, typed, and exposes only the ones its factory named', () => {
    const error = BookingError.slotTaken('cal-1', startsAt);

    expectTypeOf(error.facts.calendarId).toEqualTypeOf<string>();
    expectTypeOf(error.facts.startsAt).toEqualTypeOf<Date>();
    expect(error.facts).toEqual({ calendarId: 'cal-1', startsAt });
    expect(error.exposedFacts).toEqual({ startsAt });
    expect(BookingError.tooLate(30).exposedFacts).toEqual({});
    expect(BookingError.reasonRequired().facts).toEqual({});
  });

  it('serialises without stack, cause or private fact', () => {
    const taken = JSON.parse(JSON.stringify(BookingError.slotTaken('cal-1', startsAt)));
    const late = JSON.parse(JSON.stringify(BookingError.tooLate(30)));

    expect(taken).toEqual({
      name: 'BookingError',
      code: 'SLOT_TAKEN',
      message: 'The slot at 2026-03-02T09:00:00.000Z on cal-1 is held.',
      facts: { startsAt: '2026-03-02T09:00:00.000Z' },
    });

    expect(late).toEqual({
      name: 'BookingError',
      code: 'BOOKING_TOO_LATE',
      message: 'A slot is booked 30 minutes ahead.',
    });
  });

  it('keeps the cause a factory gives', () => {
    const cause = new Error('connection reset');

    expect(BookingError.storeUnreachable(cause).cause).toBe(cause);
    expect(Object.keys(BookingError.storeUnreachable(cause))).not.toContain('cause');
    expect(BookingError.reasonRequired().cause).toBeUndefined();
  });

  it('derives the closed vocabulary of a class from its factories', () => {
    expectTypeOf<CodeOf<typeof BookingError>>().toEqualTypeOf<
      'SLOT_TAKEN' | 'BOOKING_TOO_LATE' | 'REASON_REQUIRED' | 'STORE_UNREACHABLE'
    >();

    expectTypeOf<CodeOf<typeof WaitlistError>>().toEqualTypeOf<'ALREADY_WAITING'>();
  });

  it('narrows by class and code, so that a switch on the code is exhaustive', () => {
    expect(describeRefusal(BookingError.slotTaken('cal-1', startsAt))).toBe('taken at 2026-03-02T09:00:00.000Z');
    expect(describeRefusal(BookingError.tooLate(30))).toBe('notice 30');
    expect(describeRefusal(BookingError.reasonRequired())).toBe('REASON_REQUIRED');
    expect(describeRefusal(WaitlistError.alreadyWaiting('p-1'))).toBe('not a booking refusal');
    expect(describeRefusal(new Error('boom'))).toBe('not a booking refusal');
  });

  it('tells one refusal of a class from another by its code', () => {
    const error: unknown = BookingError.tooLate(30);

    expect(BookingError.is(error, 'BOOKING_TOO_LATE')).toBe(true);
    expect(BookingError.is(error, 'SLOT_TAKEN')).toBe(false);
    expect(WaitlistError.is(error)).toBe(false);
    expect(ConceptError.is(error)).toBe(true);
    expect(error instanceof BookingError && error.code === 'BOOKING_TOO_LATE').toBe(true);

    if (BookingError.is(error, 'BOOKING_TOO_LATE')) {
      expectTypeOf(error.facts.notice).toEqualTypeOf<number>();
    }
  });

  it('refuses at compile time a refusal built outside a factory', () => {
    // @ts-expect-error the constructor is protected
    const built = (): unknown => new BookingError('ANY', 'ad hoc', {});
    // @ts-expect-error the builder is protected
    const refused = (): unknown => BookingError.refusal('ANY', 'ad hoc');
    // @ts-expect-error exposing a fact is the decision of the factory
    const exposed = (): unknown => BookingError.tooLate(30).exposing('notice');

    expect([built, refused, exposed]).toHaveLength(3);
  });

  it('travels in a Result and is thrown by unwrap', () => {
    const result = err(WaitlistError.alreadyWaiting('p-1'));

    expect(() => unwrap(result)).toThrow(WaitlistError);
  });
});

describe('isRefusal', () => {
  it('knows a refusal by its code, whatever its class or its form', () => {
    expect(isRefusal(BookingError.tooLate(30))).toBe(true);
    expect(isRefusal(BookingError.tooLate(30), 'BOOKING_TOO_LATE')).toBe(true);
    expect(isRefusal(BookingError.tooLate(30), 'SLOT_TAKEN')).toBe(false);
    expect(isRefusal(new LegacyError('old form'), 'LEGACY')).toBe(true);
    expect(isRefusal(new InvariantViolation('broken'), 'INVARIANT_VIOLATION')).toBe(true);
    expect(isRefusal(new Error('boom'))).toBe(false);
    expect(isRefusal({ code: 'LEGACY' }, 'LEGACY')).toBe(false);
  });
});

describe('DomainError', () => {
  it('keeps the form of 0.2.0: a class per error, a code as a field, a public constructor', () => {
    const cause = new Error('root');
    const error = new LegacyError('The old form.', { cause });

    expect(error.code).toBe('LEGACY');
    expect(error.name).toBe('LegacyError');
    expect(error.cause).toBe(cause);

    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: 'LegacyError',
      code: 'LEGACY',
      message: 'The old form.',
    });
  });
});
