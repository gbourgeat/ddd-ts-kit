import { describe, expect, it } from 'vitest';
import { TimeZone } from '@/contexts/identity/domain/value-objects/time-zone.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

describe('TimeZone', () => {
  it('is equal to another time zone with the same value', () => {
    const first = TimeZone.create('Europe/Paris');
    const second = TimeZone.create('Europe/Paris');

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    expectRefusal(() => TimeZone.create('  '), 'UNKNOWN_TIME_ZONE');
  });

  it.each(['Europe/Paris', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland'])(
    'accepts the IANA zone %s',
    (zone) => {
      expect(() => TimeZone.create(zone)).not.toThrow();
    },
  );

  it.each(['Paris', 'Europe/Atlantis', '+02:00', 'CET', 'UTC'])(
    'refuses "%s", which is not the zone of a place',
    (zone) => {
      expectRefusal(() => TimeZone.create(zone), 'UNKNOWN_TIME_ZONE');
    },
  );

  it('reads the same zone whatever its case and the spaces around it', () => {
    const typed = TimeZone.create(' europe/paris ');

    expect(typed.value).toBe('Europe/Paris');
  });
});
