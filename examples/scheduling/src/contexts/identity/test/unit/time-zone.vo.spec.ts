import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { TimeZone } from '../../domain/value-objects/time-zone.vo.js';

describe('TimeZone', () => {
  it('is equal to another time zone with the same value', () => {
    const first = unwrap(TimeZone.create('Europe/Paris'));
    const second = unwrap(TimeZone.create('Europe/Paris'));

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    const result = TimeZone.create('  ');

    expect(result).toMatchObject({ ok: false, error: { code: 'UNKNOWN_TIME_ZONE' } });
  });

  it.each(['Europe/Paris', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland'])('accepts the IANA zone %s', (zone) => {
    const result = TimeZone.create(zone);

    expect(result.ok).toBe(true);
  });

  it.each(['Paris', 'Europe/Atlantis', '+02:00', 'CET', 'UTC'])('refuses "%s", which is not the zone of a place', (zone) => {
    const result = TimeZone.create(zone);

    expect(result).toMatchObject({ ok: false, error: { code: 'UNKNOWN_TIME_ZONE' } });
  });

  it('reads the same zone whatever its case and the spaces around it', () => {
    const typed = unwrap(TimeZone.create(' europe/paris '));

    expect(typed.value).toBe('Europe/Paris');
  });
});
