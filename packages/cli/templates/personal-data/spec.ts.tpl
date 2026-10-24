import { afterAll, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
{{#if orm.drizzle}}
import { eq } from 'drizzle-orm';
{{/if}}
{{#if orm.knex}}
import type { Knex } from 'knex';
{{/if}}
import {
{{#if personal.pseudonymise}}
  ERASED_PERSONAL_DATA,
{{/if}}
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from '{{alias.context}}/infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository{{alias.ext}}';
import { {{personal.names.adapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.adapterKebab}}.repository{{alias.ext}}';
import { {{personal.names.exportAdapter}} } from '{{alias.context}}/infrastructure/persistence/{{personal.names.exportAdapterKebab}}.repository{{alias.ext}}';
{{#if orm.knex}}
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { {{aggregate.pascal}}Row } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';
{{/if}}
{{#if orm.drizzle}}
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
{{/if}}
{{#if orm.typeorm}}
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import type { {{aggregate.pascal}}Row } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';
{{/if}}
{{#if orm.prisma}}
import type { Prisma, {{context.pascal}}{{aggregate.pascal}} as {{aggregate.pascal}}Row } from '{{alias.generated}}/prisma/client{{alias.ext}}';
{{/if}}
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { {{aggregate.article}}{{aggregate.pascal}} } from '{{alias.context}}/test/builders/{{aggregate.kebab}}.builder{{alias.ext}}';
import { {{personal.names.fake}} } from '{{alias.context}}/test/fakes/{{personal.names.portKebab}}.fake{{alias.ext}}';
import { {{personal.names.exportFake}} } from '{{alias.context}}/test/fakes/{{personal.names.exportPortKebab}}.fake{{alias.ext}}';

{{#if orm.drizzle}}
type {{aggregate.pascal}}Row = typeof {{aggregate.tableCamel}}.$inferSelect;

/** What a test writes into the columns of a person: the generated mapper writes none of them yet. */
type Personal = Partial<typeof {{aggregate.tableCamel}}.$inferInsert>;
{{/if}}
{{#if orm.prisma}}
/** What a test writes into the columns of a person: the generated mapper writes none of them yet. */
type Personal = Prisma.{{context.pascal}}{{aggregate.pascal}}UpdateInput;
{{/if}}
{{#unless orm.drizzle}}
{{#unless orm.prisma}}
/** What a test writes into the columns of a person: the generated mapper writes none of them yet. */
type Personal = Partial<{{aggregate.pascal}}Row>;
{{/unless}}
{{/unless}}

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

/** What `{{aggregate.table}}` keeps of two people in clear, as a use case would have written it. */
const OF_ADA: Personal = {{personal.ofAda}};

const OF_BOB: Personal = {{personal.ofBob}};
{{#if personal.pseudonymise}}

/** What the row of Ada reads once she is erased: the declaration says `pseudonymise`. */
const ERASED = {{personal.erased}};
{{/if}}

/** The source every record of `{{aggregate.table}}` names: the context, then the table. */
const SOURCE = '{{context.kebab}}.{{aggregate.table}}';

/** What the export hands over of Ada: the personal columns alone, as plain data. */
const EXPORTED_OF_ADA = {{personal.exportedOfAda}};
{{#if personal.pseudonymise}}

/** What the export hands over once Ada is erased: what the row reads. */
const EXPORTED_ERASED = {{personal.exportedErased}};
{{/if}}

let database: TestDatabase;
let scope: FixedExecutionScope;
let repository: {{adapter.pascal}}{{aggregate.pascal}}Repository;
let erasure: {{personal.names.adapter}};
let exported: {{personal.names.exportAdapter}};

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
  scope = new FixedExecutionScope(workOf('acme'));
  repository = new {{adapter.pascal}}{{aggregate.pascal}}Repository(database.persistence.database, scope, clock);
  erasure = new {{personal.names.adapter}}(database.persistence.database{{#if tenant.scoped}}, scope{{/if}});
  exported = new {{personal.names.exportAdapter}}(database.persistence.database{{#if tenant.scoped}}, scope{{/if}});
});

describe('{{personal.names.adapter}}', () => {
  it('erases what {{aggregate.table}} keeps of the subject, as the declaration says, and answers the rows it reached', async () => {
    const ada = await saved(OF_ADA);
    const bob = await saved(OF_BOB);

    expect(await erasure.erase({{#if personal.subjectIsId}}ada{{/if}}{{#unless personal.subjectIsId}}'ada'{{/unless}})).toBe(1);
{{#if personal.pseudonymise}}
    expect(await rowOf(ada)).toMatchObject(ERASED);
{{/if}}
{{#if personal.row}}
    expect(await rowOf(ada)).toBeUndefined();
{{/if}}
    expect(await rowOf(bob)).toMatchObject(OF_BOB);
  });

  it('reaches nothing the second time: an erasure run again completes one that failed half way', async () => {
{{#if personal.subjectIsId}}
    const ada = await saved(OF_ADA);
{{/if}}
{{#unless personal.subjectIsId}}
    await saved(OF_ADA);
{{/unless}}

    await erasure.erase({{#if personal.subjectIsId}}ada{{/if}}{{#unless personal.subjectIsId}}'ada'{{/unless}});

    expect(await erasure.erase({{#if personal.subjectIsId}}ada{{/if}}{{#unless personal.subjectIsId}}'ada'{{/unless}})).toBe(0);
  });
});

describe('{{personal.names.exportAdapter}}', () => {
  it('hands over what {{aggregate.table}} keeps of the subject as plain data, under its source, and nothing of the others', async () => {
{{#if personal.subjectIsId}}
    const ada = await saved(OF_ADA);

    await saved(OF_BOB);
{{/if}}
{{#unless personal.subjectIsId}}
    await saved(OF_ADA);
    await saved(OF_BOB);
{{/unless}}

    expect(await exported.exportOf({{#if personal.subjectIsId}}ada{{/if}}{{#unless personal.subjectIsId}}'ada'{{/unless}})).toEqual([{ source: SOURCE, values: EXPORTED_OF_ADA }]);
  });

  it('answers what the row reads once the subject is erased{{#if personal.row}}: nothing, the row is gone{{/if}}', async () => {
{{#if personal.subjectIsId}}
    const ada = await saved(OF_ADA);
{{/if}}
{{#unless personal.subjectIsId}}
    await saved(OF_ADA);
{{/unless}}

    await erasure.erase({{#if personal.subjectIsId}}ada{{/if}}{{#unless personal.subjectIsId}}'ada'{{/unless}});

{{#if personal.pseudonymise}}
    expect(await exported.exportOf({{#if personal.subjectIsId}}ada{{/if}}{{#unless personal.subjectIsId}}'ada'{{/unless}})).toEqual([{ source: SOURCE, values: EXPORTED_ERASED }]);
{{/if}}
{{#if personal.row}}
    expect(await exported.exportOf({{#if personal.subjectIsId}}ada{{/if}}{{#unless personal.subjectIsId}}'ada'{{/unless}})).toEqual([]);
{{/if}}
  });
});

describe('{{personal.names.fake}} and {{personal.names.exportFake}}', () => {
  it('counts the rows it holds of a person, and forgets them at the first erasure', async () => {
    const fake = new {{personal.names.fake}}().holds('ada', 2);

    expect(await fake.erase('ada')).toBe(2);
    expect(await fake.erase('ada')).toBe(0);
    expect(fake.erased).toEqual(['ada', 'ada']);
  });

  it('hands over the records it holds of a person, and remembers who was asked', async () => {
    const record = { source: SOURCE, values: EXPORTED_OF_ADA };
    const fake = new {{personal.names.exportFake}}().holds('ada', record);

    expect(await fake.exportOf('ada')).toEqual([record]);
    expect(await fake.exportOf('bob')).toEqual([]);
    expect(fake.asked).toEqual(['ada', 'bob']);
  });
});

/** {{aggregate.article}} {{aggregate.pascal}} saved through its repository, then given what the table keeps of the person. Answers its id. */
async function saved(personal: Personal): Promise<string> {
  const aggregate = {{aggregate.article}}{{aggregate.pascal}}().build();

  await repository.save(aggregate);
  await write(aggregate.id, personal);

  return aggregate.id;
}

{{#if orm.knex}}
async function write(id: string, personal: Personal): Promise<void> {
  await table().where({ id }).update(personal);
}

async function rowOf(id: string): Promise<{{aggregate.pascal}}Row | undefined> {
  const row = await table().where({ id }).first();

  return row;
}

/** A function and not a method: a query builder is thenable. */
function table(): Knex.QueryBuilder<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]> {
  const rows = database.persistence.database.executor()<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]>('{{aggregate.table}}');

  return rows.withSchema({{context.constant}}_SCHEMA);
}
{{/if}}
{{#if orm.drizzle}}
async function write(id: string, personal: Personal): Promise<void> {
  const byId = eq({{aggregate.tableCamel}}.id, id);

  await database.persistence.database.executor().update({{aggregate.tableCamel}}).set(personal).where(byId);
}

async function rowOf(id: string): Promise<{{aggregate.pascal}}Row | undefined> {
  const byId = eq({{aggregate.tableCamel}}.id, id);
  const [row] = await database.persistence.database.executor().select().from({{aggregate.tableCamel}}).where(byId);

  return row;
}
{{/if}}
{{#if orm.prisma}}
async function write(id: string, personal: Personal): Promise<void> {
  const rows = database.persistence.database.client().{{context.camel}}{{aggregate.pascal}};

  await rows.update({ where: { id }, data: personal });
}

async function rowOf(id: string): Promise<{{aggregate.pascal}}Row | undefined> {
  const rows = database.persistence.database.client().{{context.camel}}{{aggregate.pascal}};
  const row = await rows.findUnique({ where: { id } });

  return row ?? undefined;
}
{{/if}}
{{#if orm.typeorm}}
async function write(id: string, personal: Personal): Promise<void> {
  await database.persistence.database.manager().update({{aggregate.tableCamel}}, { id }, personal);
}

async function rowOf(id: string): Promise<{{aggregate.pascal}}Row | undefined> {
  const row = await database.persistence.database.manager().findOneBy({{aggregate.tableCamel}}, { id });

  return row ?? undefined;
}
{{/if}}

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'personal-data-spec', actor, origin: 'test' });
}
