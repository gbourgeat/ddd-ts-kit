import { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('Slot', () => {
  it('is equal to another slot with the same instants', () => {
    const first = Slot.create(at('09:00'), at('09:30'), at('09:40'));
    const second = Slot.between(at('09:00'), at('09:30'), at('09:40'));

    expect(first.equals(second)).toBe(true);
  });

  it('accepts a slot that holds nothing after its end', () => {
    const slot = Slot.between(at('09:00'), at('09:30'), at('09:30'));

    expect(slot.heldUntil).toEqual(at('09:30'));
  });

  it.each([
    ['ends when it starts', [at('09:00'), at('09:00'), at('09:10')]],
    ['ends before it starts', [at('09:30'), at('09:00'), at('09:40')]],
    ['is held less than it lasts', [at('09:00'), at('09:30'), at('09:20')]],
    ['has an instant that is no date', [at('09:00'), new Date(Number.NaN), at('09:40')]],
  ] as const)('refuses a slot that %s', (_rule, [startsAt, endsAt, heldUntil]) => {
    expectRefusal(() => Slot.create(startsAt, endsAt, heldUntil), 'INVALID_SLOT');
    expect(() => Slot.between(startsAt, endsAt, heldUntil)).toThrow(expect.objectContaining({ code: 'INVALID_SLOT' }));
  });

  it('overlaps a slot that starts inside its buffer', () => {
    const held = Slot.between(at('09:00'), at('09:30'), at('09:40'));
    const inTheBuffer = Slot.between(at('09:30'), at('10:00'), at('10:00'));

    expect(held.overlaps(inTheBuffer)).toBe(true);
    expect(inTheBuffer.overlaps(held)).toBe(true);
  });

  it('does not overlap a slot that starts when what it holds ends', () => {
    const held = Slot.between(at('09:00'), at('09:30'), at('09:40'));
    const next = Slot.between(at('09:40'), at('10:10'), at('10:20'));

    expect(held.overlaps(next)).toBe(false);
    expect(next.overlaps(held)).toBe(false);
  });

  it('overlaps another slot in both directions or in none, for any two slots', () => {
    fc.assert(fc.property(anySlot(), anySlot(), (one, other) => one.overlaps(other) === other.overlaps(one)));
  });

  it('is held at least until it ends, for any slot', () => {
    fc.assert(fc.property(anySlot(), (slot) => slot.heldUntil.getTime() >= slot.endsAt.getTime()));
  });

  it('says whether it starts after an instant', () => {
    const slot = Slot.between(at('09:00'), at('09:30'), at('09:40'));

    expect(slot.startsAfter(at('08:59'))).toBe(true);
    expect(slot.startsAfter(at('09:00'))).toBe(false);
  });

  it('keeps its instants out of reach of its callers', () => {
    const slot = Slot.between(at('09:00'), at('09:30'), at('09:40'));

    slot.startsAt.setFullYear(2000);

    expect(slot.startsAt).toEqual(at('09:00'));
  });
});

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}

/** Any slot of a morning: a start, a length and a buffer in minutes, the buffer possibly empty. */
function anySlot(): fc.Arbitrary<Slot> {
  return fc
    .tuple(fc.integer({ min: 0, max: 600 }), fc.integer({ min: 5, max: 180 }), fc.integer({ min: 0, max: 60 }))
    .map(([start, length, buffer]) =>
      Slot.between(
        minutesFromEight(start),
        minutesFromEight(start + length),
        minutesFromEight(start + length + buffer),
      ),
    );
}

function minutesFromEight(count: number): Date {
  return new Date(Date.UTC(2026, 2, 2, 8, 0) + count * 60_000);
}
