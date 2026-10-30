import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryPersonalData, personalFields, type ErasureMode } from '@ddd-ts-kit/kernel';
import {
  personalDataErasureContract,
  personalDataExportContract,
  personalDataRetentionContract,
  type PersonalDataRetentionUnderContract,
} from '../src/contracts';
import { CollectingRunner } from './support/collecting-runner';

interface PersonRow {
  readonly id: string;
  readonly display_name: string;
  readonly email: string;
  readonly age: number;
  readonly avatar_key: string | null;
  readonly registered_at: Date;
  readonly ended_at?: Date | null;
}

const runner = { describe, it, expect, beforeEach };

function declarationOf(erasure: ErasureMode) {
  return personalFields<PersonRow>('persons', {
    subject: 'id',
    fields: ['display_name', 'email', 'age'],
    files: ['avatar_key'],
    erasure,
  });
}

/** The same declaration without file column: what most tables of a context are. */
function declarationWithoutFiles(erasure: ErasureMode) {
  return personalFields<PersonRow>('persons', {
    subject: 'id',
    fields: ['display_name', 'email', 'age'],
    erasure,
  });
}

function aRowOf(subject: string, n: number): PersonRow {
  return {
    id: subject,
    display_name: `${subject} ${n}`,
    email: `${subject}-${n}@example.org`,
    age: 30 + n,
    avatar_key: `tenants/acme/avatars/${subject}-${n}`,
    registered_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

for (const erasure of ['row', 'pseudonymise'] as const) {
  personalDataErasureContract<PersonRow>(runner, {
    name: `InMemoryPersonalData, ${erasure}`,
    create: () => {
      const table = new InMemoryPersonalData('identity.persons', declarationOf(erasure));

      return {
        declaration: declarationOf(erasure),
        erasure: table,
        insert: (rows) => table.insert(...rows),
        rowsOf: (subject) => table.all().filter((row) => row.id === subject),
        aRowOf,
      };
    },
    createWithoutFiles: () => {
      const table = new InMemoryPersonalData('identity.persons', declarationWithoutFiles(erasure));

      return {
        declaration: declarationWithoutFiles(erasure),
        erasure: table,
        insert: (rows) => table.insert(...rows),
        rowsOf: (subject) => table.all().filter((row) => row.id === subject),
        aRowOf,
      };
    },
  });
}

personalDataExportContract<PersonRow>(runner, {
  name: 'InMemoryPersonalData',
  create: () => {
    const table = new InMemoryPersonalData('identity.persons', declarationOf('row'));

    return {
      declaration: declarationOf('row'),
      exporter: table,
      insert: (rows) => table.insert(...rows),
      rowsOf: (subject) => table.all().filter((row) => row.id === subject),
      aRowOf,
    };
  },
});

for (const erasure of ['row', 'pseudonymise'] as const) {
  personalDataRetentionContract<PersonRow>(runner, {
    name: `InMemoryPersonalData, ${erasure}`,
    create: () => {
      const declaration = personalFields<PersonRow>('persons', {
        subject: 'id',
        fields: ['display_name', 'email', 'age'],
        files: ['avatar_key'],
        erasure,
        retention: { after: 'ended_at', months: 6 },
      });

      const table = new InMemoryPersonalData('identity.persons', declaration);

      return {
        declaration,
        retention: table,
        insert: (rows) => table.insert(...rows),
        rowsOf: (subject) => table.all().filter((row) => row.id === subject),
        aRowOf,
        aRowFrom: (subject, n, at) => ({ ...aRowOf(subject, n), ended_at: at }),
      };
    },
  });
}

/** The in-memory table under the retention contract, over a declaration that gives no retention. */
function withoutRetention(): PersonalDataRetentionUnderContract<PersonRow> {
  const declaration = declarationOf('row');
  const table = new InMemoryPersonalData('identity.persons', declaration);

  return {
    declaration,
    retention: table,
    insert: (rows) => table.insert(...rows),
    rowsOf: (subject) => table.all().filter((row) => row.id === subject),
    aRowOf,
    aRowFrom: (subject, n, at) => ({ ...aRowOf(subject, n), ended_at: at }),
  };
}

describe('the retention contract and a declaration that gives no retention', () => {
  it('fails every case that needs the end of the retention, and says so', async () => {
    const collecting = new CollectingRunner();

    personalDataRetentionContract<PersonRow>(collecting, { name: 'no retention', create: withoutRetention });

    const { failed, messages } = await collecting.run();

    expect(failed).toEqual([
      'erases the rows whose retention ended, as the declaration says, and answers how many',
      'leaves a row still within its retention and a row whose retention never started',
      'reaches nothing the second time: a purge is safe to run again',
    ]);

    expect(new Set(messages)).toEqual(new Set(['The declaration under the retention contract gives no retention']));
  });
});
