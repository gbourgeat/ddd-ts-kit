import { describe, expect, it } from 'vitest';
import { ConflictError } from '@ddd-ts-kit/kernel';
import { UNIT_OF_WORK, createTestApplication, fake } from '@ddd-ts-kit/di';
import { ForbiddenError } from '../src/index.js';
import { authorizationModule } from '../src/di.js';
import { InMemoryRelationTupleStore, RelationBasedAuthorizer, SchemaCheckedTupleStore } from '../src/rebac.js';
import { anActor } from '../src/testing.js';
import {
  CreateDocument,
  DOCUMENT_GRANTS,
  DOCUMENT_REPOSITORY,
  GetDocument,
  ShareDocument,
  StagedDocumentRepository,
  StagingUnitOfWork,
  TupleDocumentGrants,
  docsModule,
  mapping,
  schema,
} from './support/sharing.js';

const ada = anActor().named('ada').build();
const bob = anActor().named('bob').build();

async function workspace() {
  const tuples = new InMemoryRelationTupleStore();
  await tuples.write([
    { object: 'workspace:acme', relation: 'member', subject: 'user:ada' },
    { object: 'group:eng', relation: 'member', subject: 'user:bob' },
  ]);
  const unitOfWork = new StagingUnitOfWork();
  const documents = new StagedDocumentRepository(unitOfWork);
  const app = createTestApplication({
    modules: [
      docsModule,
      authorizationModule({ authorizer: new RelationBasedAuthorizer({ schema, store: tuples, mapping }) }),
    ],
    fakes: [
      fake(UNIT_OF_WORK, unitOfWork),
      fake(DOCUMENT_REPOSITORY, documents),
      fake(DOCUMENT_GRANTS, new TupleDocumentGrants(unitOfWork, new SchemaCheckedTupleStore(schema, tuples))),
    ],
    authorization: 'required',
  });
  return { app, tuples, documents };
}

describe('keeping relationships in sync with the aggregates', () => {
  it('records the owner when a document is created, through a port of the application', async () => {
    const { app, tuples, documents } = await workspace();

    const id = await app.commandBus.execute(new CreateDocument(ada, 'acme', 'Roadmap'));

    expect(documents.documents.get(id)).toEqual({ id: 'id-1', title: 'Roadmap' });
    expect(await tuples.readByObject('document:id-1', 'owner')).toEqual([
      { object: 'document:id-1', relation: 'owner', subject: 'user:ada' },
    ]);
    expect(await app.queryBus.execute(new GetDocument(ada, id))).toEqual({ id: 'id-1', title: 'Roadmap' });
  });

  it('opens the document to a group when its owner shares it', async () => {
    const { app } = await workspace();
    const id = await app.commandBus.execute(new CreateDocument(ada, 'acme', 'Roadmap'));
    await expect(app.queryBus.execute(new GetDocument(bob, id))).rejects.toBeInstanceOf(ForbiddenError);

    await app.commandBus.execute(new ShareDocument(ada, id, 'eng'));

    expect(await app.queryBus.execute(new GetDocument(bob, id))).toEqual({ id: 'id-1', title: 'Roadmap' });
    await expect(app.commandBus.execute(new ShareDocument(bob, id, 'eng'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
      reason: 'NO_RELATION',
    });
  });

  it('leaves no relationship behind when the unit of work fails: same transaction', async () => {
    const { app, tuples, documents } = await workspace();
    await app.commandBus.execute(new CreateDocument(ada, 'acme', 'Roadmap'));
    const before = tuples.all();

    await expect(app.commandBus.execute(new CreateDocument(ada, 'acme', 'Roadmap'))).rejects.toBeInstanceOf(ConflictError);

    expect(tuples.all()).toEqual(before);
    expect([...documents.documents.keys()]).toEqual(['id-1']);
  });

  it('refuses the creation to somebody who is not a member of the workspace, before anything is written', async () => {
    const { app, tuples, documents } = await workspace();

    await expect(app.commandBus.execute(new CreateDocument(bob, 'acme', 'Plan'))).rejects.toBeInstanceOf(ForbiddenError);

    expect(documents.documents.size).toBe(0);
    expect(tuples.all()).toHaveLength(2);
  });
});
