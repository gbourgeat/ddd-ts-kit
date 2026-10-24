import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ERASED_PERSONAL_DATA, FixedExecutionScope, InMemoryFileStorage, personalFields } from '@ddd-ts-kit/kernel';
import {
  PrismaContext,
  PrismaPersonalDataErasure,
  createPrismaUnitOfWork,
  type PrismaPersonalTable,
  type PrismaRawCommands,
} from '../../src';
import type { Prisma } from '../generated/client/client';
import { createDatabase, type TestDatabase } from '../support/database';
import {
  PEOPLE,
  aPersonRow,
  declarationOf,
  insertPeople,
  peopleOf,
  workIn,
  type PersonRow,
} from '../support/personal-data/people';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const insert = (rows: readonly PersonRow[]): Promise<void> => insertPeople(database.prisma, rows);

const rowsOf = (subject: string, tenant?: string): Promise<PersonRow[]> => peopleOf(database.prisma, subject, tenant);

interface MistypedRow extends PersonRow {
  readonly nickname: string;
}

/** A row of a table of the default schema, named without one. */
interface PublicRow {
  readonly id: string;
  readonly person_id: string;
  readonly display_name: string;
  readonly age: number | null;
}

/** A client that answers no row set to a query: what the erasure makes of it. */
class NoRows extends PrismaContext<PrismaRawCommands> {
  client(): PrismaRawCommands {
    return { $queryRawUnsafe: () => Promise.resolve(undefined), $executeRawUnsafe: () => Promise.resolve(0) };
  }

  inTransaction(): boolean {
    return false;
  }
}

describe('PrismaPersonalDataErasure, the table as the catalogue knows it', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('needs no file storage for a declaration without file columns, and deletes the rows of the subject', async () => {
    await insert([aPersonRow('ada', 1), aPersonRow('bob', 1)]);

    const plain = new PrismaPersonalDataErasure<Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
      name: 'identity.people',
      declarations: [
        personalFields<PersonRow, PrismaPersonalTable>(PEOPLE, {
          subject: 'person_id',
          fields: ['display_name', 'email'],
          erasure: 'row',
        }),
      ],
      tenant: { scope: new FixedExecutionScope(workIn('acme')) },
    });

    expect(await plain.erase('ada')).toBe(1);
    expect(await rowsOf('ada')).toEqual([]);
    expect(await rowsOf('bob')).toHaveLength(1);
  });

  it('refuses a declaration that names a column the table does not have, before any file or row is touched', async () => {
    const files = new InMemoryFileStorage();
    const ada = aPersonRow('ada', 1);

    await files.put(ada.avatar_key ?? '', Readable.from([Buffer.from('png')]), { mediaType: 'image/png' });
    await insert([ada]);

    const mistyped = new PrismaPersonalDataErasure<Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
      name: 'identity.people',
      declarations: [
        personalFields<MistypedRow, PrismaPersonalTable>(PEOPLE, {
          subject: 'person_id',
          fields: ['nickname'],
          files: ['avatar_key'],
          erasure: 'pseudonymise',
        }),
      ],
      tenant: { scope: new FixedExecutionScope(workIn('acme')) },
      files,
    });

    await expect(mistyped.erase('ada')).rejects.toThrow('has no column "nickname"');

    expect(await files.stat(ada.avatar_key ?? '')).toBeDefined();
    expect(await rowsOf('ada')).toEqual([ada]);
  });

  it('reaches a table of the default schema, named without one', async () => {
    const client = database.prisma;

    await client.$executeRawUnsafe(
      'create table if not exists public.people_public (id text primary key, person_id text not null, display_name text not null, age integer)',
    );

    await client.$executeRawUnsafe(
      "insert into public.people_public values ('1', 'ada', 'Ada', 36), ('2', 'bob', 'Bob', 40)",
    );

    try {
      const everywhere = new PrismaPersonalDataErasure<Prisma.TransactionClient>(createPrismaUnitOfWork(client), {
        name: 'identity.people_public',
        declarations: [
          personalFields<PublicRow, PrismaPersonalTable>(
            { table: 'people_public' },
            { subject: 'person_id', fields: ['display_name', 'age'], erasure: 'pseudonymise' },
          ),
        ],
      });

      expect(await everywhere.erase('ada')).toBe(1);

      expect(await client.$queryRawUnsafe('select display_name, age from public.people_public order by id')).toEqual([
        { display_name: ERASED_PERSONAL_DATA, age: null },
        { display_name: 'Bob', age: 40 },
      ]);
    } finally {
      await client.$executeRawUnsafe('drop table public.people_public');
    }
  });

  it('reaches nothing when the client answers no row set', async () => {
    const silent = new PrismaPersonalDataErasure<PrismaRawCommands>(new NoRows(), {
      name: 'identity.people',
      declarations: [declarationOf('row')],
      files: new InMemoryFileStorage(),
    });

    expect(await silent.erase('ada')).toBe(0);
  });
});
