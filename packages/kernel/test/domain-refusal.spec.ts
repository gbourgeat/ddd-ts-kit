import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ConceptError,
  DomainError,
  DomainRefusal,
  FactualRefusal,
  InvariantViolation,
  err,
  isRefusal,
  unwrap,
} from '../src/index.js';
import {
  AgendaUnreachable,
  BookingTooLate,
  type SchedulingCode,
  SchedulingCodes,
  SlotTaken,
} from './support/scheduling-refusals.js';

const startsAt = new Date('2026-03-02T09:00:00.000Z');

function nextStep(error: unknown): string | undefined {
  if (!isRefusal(error, SchedulingCodes)) {
    return undefined;
  }

  switch (error.code) {
    case 'SLOT_TAKEN':
      return 'choose another slot';
    case 'BOOKING_TOO_LATE':
      return 'book earlier';
    case 'AGENDA_UNREACHABLE':
      return 'try again later';
  }
}

describe('DomainRefusal', () => {
  it('builds a refusal through a factory: a DomainError named after its class, with the code of its class', () => {
    const error = SlotTaken.forCalendar('cal-1', startsAt);

    expect(error).toBeInstanceOf(SlotTaken);
    expect(error).toBeInstanceOf(DomainRefusal);
    expect(error).toBeInstanceOf(FactualRefusal);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('SlotTaken');
    expect(error.code).toBe('SLOT_TAKEN');
    expect(error.message).toBe('The slot at 2026-03-02T09:00:00.000Z on cal-1 is held.');
    expect(error.stack).toContain('SlotTaken');
    expectTypeOf(error.code).toEqualTypeOf<'SLOT_TAKEN'>();
  });

  it('sets one code whatever the factory', () => {
    expect(SlotTaken.atStart(startsAt).code).toBe('SLOT_TAKEN');
    expect(SlotTaken.forCalendar('cal-1', startsAt).code).toBe('SLOT_TAKEN');
  });

  it('carries the facts of its factory, typed, and exposes only the ones the factory named', () => {
    const error = SlotTaken.forCalendar('cal-1', startsAt);

    expectTypeOf(error.facts.calendarId).toEqualTypeOf<string>();
    expectTypeOf(error.facts.startsAt).toEqualTypeOf<Date>();
    expect(error.facts).toEqual({ calendarId: 'cal-1', startsAt });
    expect(error.exposedFacts).toEqual({ startsAt });
    expect(BookingTooLate.withNotice(30).exposedFacts).toEqual({});
    expect(AgendaUnreachable.becauseOf(new Error('reset')).facts).toEqual({});
  });

  it('serialises without stack, cause or private fact', () => {
    expect(JSON.parse(JSON.stringify(SlotTaken.forCalendar('cal-1', startsAt)))).toEqual({
      name: 'SlotTaken',
      code: 'SLOT_TAKEN',
      message: 'The slot at 2026-03-02T09:00:00.000Z on cal-1 is held.',
      facts: { startsAt: '2026-03-02T09:00:00.000Z' },
    });

    expect(JSON.parse(JSON.stringify(BookingTooLate.withNotice(30)))).toEqual({
      name: 'BookingTooLate',
      code: 'BOOKING_TOO_LATE',
      message: 'A slot is booked 30 minutes ahead.',
    });
  });

  it('keeps the cause a factory gives, out of its own keys', () => {
    const cause = new Error('connection reset');

    expect(AgendaUnreachable.becauseOf(cause).cause).toBe(cause);
    expect(Object.keys(AgendaUnreachable.becauseOf(cause))).not.toContain('cause');
    expect(BookingTooLate.withNotice(30).cause).toBeUndefined();
  });

  it('narrows what was caught to its class, with the facts of each of its factories', () => {
    const error: unknown = SlotTaken.atStart(startsAt);

    expect(SlotTaken.is(error)).toBe(true);
    expect(BookingTooLate.is(error)).toBe(false);
    expect(DomainRefusal.is(error)).toBe(true);
    expect(SlotTaken.is(new Error('boom'))).toBe(false);

    if (SlotTaken.is(error)) {
      expectTypeOf(error.code).toEqualTypeOf<'SLOT_TAKEN'>();
      expectTypeOf(error.facts.startsAt).toEqualTypeOf<Date>();
    }
  });

  it('keys on the closed list of the codes of its context, so that a switch on the code is exhaustive', () => {
    expect(nextStep(SlotTaken.atStart(startsAt))).toBe('choose another slot');
    expect(nextStep(BookingTooLate.withNotice(30))).toBe('book earlier');
    expect(nextStep(AgendaUnreachable.becauseOf(undefined))).toBe('try again later');
    expect(nextStep(new Error('boom'))).toBeUndefined();
    expect(nextStep(new InvariantViolation('broken'))).toBeUndefined();
    expectTypeOf<SchedulingCode>().toEqualTypeOf<'SLOT_TAKEN' | 'BOOKING_TOO_LATE' | 'AGENDA_UNREACHABLE'>();

    const caught: unknown = BookingTooLate.withNotice(30);

    if (isRefusal(caught, SchedulingCodes)) {
      expectTypeOf(caught.code).toEqualTypeOf<SchedulingCode>();
    }
  });

  it('refuses at compile time a refusal built outside a factory', () => {
    // @ts-expect-error the constructor is protected
    const built = (): unknown => new BookingTooLate('ad hoc');
    // @ts-expect-error the builder is protected
    const refused = (): unknown => BookingTooLate.refusal('ad hoc');
    // @ts-expect-error exposing a fact is the decision of the factory
    const exposed = (): unknown => BookingTooLate.withNotice(30).exposing('notice');

    expect([built, refused, exposed]).toHaveLength(3);
  });

  it('is told apart from a refusal of a concept', () => {
    expect(ConceptError.is(SlotTaken.atStart(startsAt))).toBe(false);
    expect(isRefusal(SlotTaken.atStart(startsAt), 'SLOT_TAKEN')).toBe(true);
  });

  it('travels in a Result and is thrown by unwrap', () => {
    expect(() => unwrap(err(BookingTooLate.withNotice(30)))).toThrow(BookingTooLate);
  });
});
