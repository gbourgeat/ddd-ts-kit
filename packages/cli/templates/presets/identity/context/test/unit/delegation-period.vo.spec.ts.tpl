import { describe, expect, it } from '{{tests.module}}';
import { expectRefusal } from '@ddd-ts-kit/testing';
import { DelegationPeriod } from '{{alias.context}}/domain/value-objects/delegation-period.vo{{alias.ext}}';

const start = new Date('2026-03-01T00:00:00.000Z');
const end = new Date('2026-03-15T00:00:00.000Z');

describe('DelegationPeriod', () => {
  it('holds from its start, included, to its end, excluded', () => {
    const period = DelegationPeriod.create(start, end);

    expect(period.includes(start)).toBe(true);
    expect(period.includes(new Date('2026-03-14T23:59:59.999Z'))).toBe(true);
    expect(period.includes(end)).toBe(false);
    expect(period.includes(new Date('2026-02-28T23:59:59.999Z'))).toBe(false);
  });

  it('refuses to end before it starts, or when it starts', () => {
    expectRefusal(() => DelegationPeriod.create(end, start), 'DELEGATION_PERIOD_INVERTED');
    expectRefusal(() => DelegationPeriod.create(start, start), 'DELEGATION_PERIOD_INVERTED');
  });

  it('lasts ninety days at most', () => {
    expect(DelegationPeriod.create(start, new Date('2026-05-30T00:00:00.000Z')).endsAt).toEqual(
      new Date('2026-05-30T00:00:00.000Z'),
    );

    expectRefusal(() => DelegationPeriod.create(start, new Date('2026-05-30T00:00:00.001Z')), 'DELEGATION_TOO_LONG', {
      longestDays: 90,
    });
  });
});
