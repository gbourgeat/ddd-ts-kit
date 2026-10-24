import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryPersonalData, personalFields, type ErasureMode } from '@ddd-ts-kit/kernel';
import { personalDataErasureContract, personalDataExportContract } from '../src/contracts';

interface PersonRow {
  readonly id: string;
  readonly display_name: string;
  readonly email: string;
  readonly age: number;
  readonly avatar_key: string | null;
  readonly registered_at: Date;
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
