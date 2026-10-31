/*
 * What a failed statement quotes, as the drivers wrote it on PostgreSQL 17 (PGlite) with
 * drizzle-orm 0.45, pg 8.23, knex 3.3, TypeORM 1.1 and Prisma 7.10, each beside what is left of it.
 */

/** What `pg` throws: the message of the server, and its `detail`. */
export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'error';
  }
}

/** One form a driver quotes values in, and what the tracker receives of it. */
export interface QuotedForm {
  readonly name: string;
  readonly written: string;
  readonly sent: string;
}

export const QUOTED_FORMS: readonly QuotedForm[] = [
  {
    name: 'the parameters of a DrizzleQueryError',
    written:
      'Failed query: insert into billing.nope (email, password) values ($1, $2)\nparams: ada@example.org,hunter2',
    sent: 'Failed query: insert into billing.nope (email, password) values ($1, $2)\nparams: [redacted]',
  },
  {
    name: 'the key of a unique violation, in the detail of pg and of TypeORM',
    written: 'Key (email)=(ada@example.org) already exists.',
    sent: 'Key (email)=([redacted]) already exists.',
  },
  {
    name: 'the key of a foreign key violation',
    written: 'Key (org)=(globex) is not present in table "orgs".',
    sent: 'Key (org)=([redacted]) is not present in table "orgs".',
  },
  {
    name: 'the row of a not-null or a check violation',
    written: 'Failing row contains (carl@example.org, null, null).',
    sent: 'Failing row contains ([redacted]).',
  },
  {
    name: 'a value the server could not read, in the message of pg, knex and TypeORM',
    written:
      'insert into "people" ("age", "email") values ($1, $2) - invalid input syntax for type integer: "ada@example.org"',
    sent: 'insert into "people" ("age", "email") values ($1, $2) - invalid input syntax for type integer: "[redacted]"',
  },
  {
    name: 'the arguments of a call Prisma refused',
    written: [
      '',
      'Invalid `p.invoice.create()` invocation in',
      '/app/src/billing/infrastructure/prisma-invoices.ts:47:23',
      '',
      '  44 const inv = toRow(invoice);',
      '→ 47 await p.invoice.create({',
      '       data: {',
      '         id: "i2",',
      '         amount: "ada@example.org",',
      '                 ~~~~~~~~~~~~~~~~~',
      '         createdAt: new Date("2026-10-31T17:32:04.579Z"),',
      '         createdBy: "ada@example.org"',
      '       }',
      '     })',
      '',
      'Argument `amount`: Invalid value provided. Expected Int, provided String.',
    ].join('\n'),
    sent: [
      '',
      'Invalid `p.invoice.create()` invocation in',
      '/app/src/billing/infrastructure/prisma-invoices.ts:47:23',
      '',
      '  44 const inv = toRow(invoice);',
      '→ 47 await p.invoice.create({',
      '       data: {',
      '         id: [redacted],',
      '         amount: [redacted],',
      '                 ~~~~~~~~~~~~~~~~~',
      '         createdAt: [redacted],',
      '         createdBy: [redacted]',
      '       }',
      '     })',
      '',
      'Argument `amount`: Invalid value provided. Expected Int, provided String.',
    ].join('\n'),
  },
  {
    name: 'the arguments of a call Prisma refused without the code around it',
    written:
      'Invalid `prisma.person.findMany()` invocation:\n\n{\n  where: {\n    email: "ada@example.org"\n  }\n}\n\nUnknown argument `emial`.',
    sent: 'Invalid `prisma.person.findMany()` invocation:\n\n{\n  where: {\n    email: [redacted]\n  }\n}\n\nUnknown argument `emial`.',
  },
];
