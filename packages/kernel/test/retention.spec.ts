import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import {
  ERASED_PERSONAL_DATA,
  InMemoryFileStorage,
  InMemoryPersonalData,
  InvalidPersonalFieldsError,
  expiredBefore,
  isPersonalDataRetention,
  personalFields,
  purgeExpiredPersonalData,
  type PersonalDataRetention,
} from '../src';

interface ContractRow {
  readonly id: string;
  readonly holder_name: string;
  readonly ended_at: Date | null;
}

const NOW = new Date('2026-03-31T10:00:00.000Z');

/** A copy that answers what it is told, or fails. */
function copy(name: string, purged: number | Error): PersonalDataRetention {
  return {
    name,
    purgeExpired: async () => {
      if (purged instanceof Error) {
        throw purged;
      }

      return purged;
    },
  };
}

describe('personalFields, the retention of a declaration', () => {
  it('keeps a retention of one positive unit, counted from a date column of the row', () => {
    const declaration = personalFields<ContractRow>('contracts', {
      subject: 'id',
      fields: ['holder_name'],
      erasure: 'pseudonymise',
      retention: { after: 'ended_at', years: 5 },
    });

    expect(declaration.retention).toEqual({ after: 'ended_at', years: 5 });
  });

  it('declares no retention unless given one: the rows are kept until the person asks', () => {
    expect(
      personalFields<ContractRow>('contracts', { subject: 'id', fields: ['holder_name'], erasure: 'row' }),
    ).not.toHaveProperty('retention');
  });

  it.each([
    [{ after: 'ended_at', years: 5, months: 2 }, 'one unit'],
    [{ after: 'ended_at' }, 'one unit'],
    [{ after: 'ended_at', days: 0 }, 'a positive whole number'],
    [{ after: 'ended_at', months: 1.5 }, 'a positive whole number'],
    [{ after: 'holder_name', years: 1 }, 'which it declares personal'],
  ] as const)('refuses the retention %j', (retention, message) => {
    expect(() =>
      personalFields<ContractRow>('contracts', { subject: 'id', fields: ['holder_name'], erasure: 'row', retention }),
    ).toThrow(InvalidPersonalFieldsError);

    expect(() =>
      personalFields<ContractRow>('contracts', { subject: 'id', fields: ['holder_name'], erasure: 'row', retention }),
    ).toThrow(message);
  });
});

describe('expiredBefore', () => {
  it.each([
    [{ days: 30 }, '2026-03-01T10:00:00.000Z'],
    [{ months: 1 }, '2026-03-03T10:00:00.000Z'],
    [{ years: 3 }, '2023-03-31T10:00:00.000Z'],
  ])('counts %j back from now, in calendar units of UTC', (period, cutoff) => {
    expect(expiredBefore(period, NOW).toISOString()).toBe(cutoff);
  });
});

describe('purgeExpiredPersonalData', () => {
  it('asks every copy to purge at the same instant, and reports the rows each reached', async () => {
    const seen: Date[] = [];
    const watching: PersonalDataRetention = { name: 'crm', purgeExpired: async (now) => seen.push(now) };

    expect(await purgeExpiredPersonalData(NOW, [copy('billing', 3), watching])).toEqual({
      purged: { billing: 3, crm: 1 },
    });

    expect(seen).toEqual([NOW]);
  });

  it('runs every copy even when one fails, then throws the first failure: the next run completes it', async () => {
    const reached: string[] = [];
    const after: PersonalDataRetention = { name: 'crm', purgeExpired: async () => reached.push('crm') };

    await expect(
      purgeExpiredPersonalData(NOW, [copy('billing', new Error('billing database unreachable')), after]),
    ).rejects.toThrow('billing database unreachable');

    expect(reached).toEqual(['crm']);
  });
});

describe('isPersonalDataRetention', () => {
  it('tells a copy that also purges from one that only erases', () => {
    expect(isPersonalDataRetention(copy('billing', 0))).toBe(true);
    expect(isPersonalDataRetention({ name: 'billing', erase: async () => 0 })).toBe(false);
    expect(isPersonalDataRetention(null)).toBe(false);
  });
});

interface MemberRow {
  readonly id: string;
  readonly display_name: string;
  readonly card_key: string | null;
  readonly left_at: Date | string | null;
}

function members(erasure: 'row' | 'pseudonymise', files?: InMemoryFileStorage) {
  const declaration = personalFields<MemberRow>('members', {
    subject: 'id',
    fields: ['display_name'],
    files: ['card_key'],
    erasure,
    retention: { after: 'left_at', years: 1 },
  });

  return new InMemoryPersonalData('club', declaration, files === undefined ? {} : { files });
}

const member = (id: string, left_at: Date | string | null): MemberRow => ({
  id,
  display_name: id,
  card_key: null,
  left_at,
});

describe('InMemoryPersonalData, the purge of what outlived its retention', () => {
  it('pseudonymises a row past its retention, whether its date is a date or its ISO text, and leaves the others', async () => {
    const table = members('pseudonymise');

    table.insert(member('ada', new Date('2024-01-01T00:00:00.000Z')), member('bob', '2024-02-01T00:00:00.000Z'));
    table.insert(member('cy', NOW), member('dee', null), member('eve', 'not a date'));

    expect(await table.purgeExpired(NOW)).toBe(2);

    expect(table.all().map(({ id, display_name }) => [id, display_name])).toEqual([
      ['ada', ERASED_PERSONAL_DATA],
      ['bob', ERASED_PERSONAL_DATA],
      ['cy', 'cy'],
      ['dee', 'dee'],
      ['eve', 'eve'],
    ]);

    expect(await table.purgeExpired(NOW)).toBe(0);
  });

  it('deletes the rows in the row mode, and the files they name first', async () => {
    const files = new InMemoryFileStorage();
    const table = members('row', files);

    await files.put('cards/ada', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    table.insert({ ...member('ada', '2020-01-01T00:00:00.000Z'), card_key: 'cards/ada' }, member('bob', NOW));

    expect(await table.purgeExpired(NOW)).toBe(1);
    expect(table.all().map(({ id }) => id)).toEqual(['bob']);
    expect(await files.stat('cards/ada')).toBeUndefined();
  });

  it('purges nothing under a declaration that gives no retention', async () => {
    const table = new InMemoryPersonalData(
      'club',
      personalFields<MemberRow>('members', { subject: 'id', fields: ['display_name'], erasure: 'row' }),
    );

    table.insert(member('ada', '2000-01-01T00:00:00.000Z'));

    expect(await table.purgeExpired(NOW)).toBe(0);
    expect(table.all()).toHaveLength(1);
  });
});
