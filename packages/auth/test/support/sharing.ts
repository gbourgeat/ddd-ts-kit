import {
  AuthorizedCommand,
  AuthorizedQuery,
  ConflictError,
  NotFoundError,
  type Actor,
  type IdGenerator,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import { ID_GENERATOR, defineContextModule, token } from '@ddd-ts-kit/di';
import { definePermissions } from '../../src/index.js';
import { defineSchema, union, type RelationTupleStore } from '../../src/rebac.js';

export const docsPermissions = definePermissions('docs', {
  'document.create': { description: 'Create a document in a workspace' },
  'document.view': { description: 'Read a document' },
  'document.share': { description: 'Share a document with a group' },
});

export const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user'] } },
  workspace: { relations: { member: ['user'] }, permissions: { create_document: 'member' } },
  document: {
    relations: { owner: ['user'], viewer: ['group#member'] },
    permissions: { share: 'owner', view: union('owner', 'viewer') },
  },
});

export const mapping = {
  workspace: { [docsPermissions['document.create'].id]: 'create_document' },
  document: {
    [docsPermissions['document.view'].id]: 'view',
    [docsPermissions['document.share'].id]: 'share',
  },
};

export interface Document {
  readonly id: string;
  readonly title: string;
}

export class CreateDocument extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly workspaceId: string,
    readonly title: string,
  ) {
    super(actor);
  }
}

export class ShareDocument extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly documentId: string,
    readonly groupId: string,
  ) {
    super(actor);
  }
}

export class GetDocument extends AuthorizedQuery<Document> {
  constructor(
    actor: Actor,
    readonly documentId: string,
  ) {
    super(actor);
  }
}

/** `domain/repositories/document.repository.ts` */
export interface DocumentRepository {
  findById(id: string): Promise<Document | undefined>;
  save(document: Document): Promise<void>;
}

/**
 * `application/ports/document-grants.port.ts`: what the application says about who relates to a
 * document, in its own words. It knows nothing of tuples, schemas or the authorization model.
 */
export interface DocumentGrants {
  ownerAssigned(documentId: string, ownerId: string): Promise<void>;
  sharedWithGroup(documentId: string, groupId: string): Promise<void>;
}

export class CreateDocumentHandler {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly grants: DocumentGrants,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateDocument): Promise<string> {
    const document = { id: this.ids.next(), title: command.title };
    await this.grants.ownerAssigned(document.id, command.actor.id);
    await this.documents.save(document);
    return document.id;
  }
}

export class ShareDocumentHandler {
  constructor(private readonly grants: DocumentGrants) {}

  async execute(command: ShareDocument): Promise<void> {
    await this.grants.sharedWithGroup(command.documentId, command.groupId);
  }
}

export class GetDocumentHandler {
  constructor(private readonly documents: DocumentRepository) {}

  async execute(query: GetDocument): Promise<Document> {
    const document = await this.documents.findById(query.documentId);
    if (document === undefined) throw new NotFoundError('Document not found');
    return document;
  }
}

/** Stands for a database transaction: what was written inside `run` is kept only if it succeeds. */
export class StagingUnitOfWork implements UnitOfWork {
  #staged: (() => Promise<void>)[] | undefined;

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.#staged = [];
    try {
      const result = await work();
      for (const apply of this.#staged) await apply();
      return result;
    } finally {
      this.#staged = undefined;
    }
  }

  enlist(apply: () => Promise<void>): void {
    if (this.#staged === undefined) throw new Error('Written outside of a unit of work');
    this.#staged.push(apply);
  }
}

export class StagedDocumentRepository implements DocumentRepository {
  readonly documents = new Map<string, Document>();

  constructor(private readonly unitOfWork: StagingUnitOfWork) {}

  async findById(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async save(document: Document): Promise<void> {
    if ([...this.documents.values()].some((other) => other.title === document.title)) {
      throw new ConflictError('A document already has this title');
    }
    this.unitOfWork.enlist(async () => void this.documents.set(document.id, document));
  }
}

/**
 * `infrastructure/external/tuple-document-grants.ts`: the adapter that knows the model. With
 * a SQL tuple store it writes in the transaction the unit of work opened.
 */
export class TupleDocumentGrants implements DocumentGrants {
  constructor(
    private readonly unitOfWork: StagingUnitOfWork,
    private readonly tuples: RelationTupleStore,
  ) {}

  async ownerAssigned(documentId: string, ownerId: string): Promise<void> {
    this.#write(`document:${documentId}`, 'owner', `user:${ownerId}`);
  }

  async sharedWithGroup(documentId: string, groupId: string): Promise<void> {
    this.#write(`document:${documentId}`, 'viewer', `group:${groupId}#member`);
  }

  #write(object: string, relation: string, subject: string): void {
    this.unitOfWork.enlist(() => this.tuples.write([{ object, relation, subject }]));
  }
}

export const DOCUMENT_REPOSITORY = token<DocumentRepository>('docs.DocumentRepository');
export const DOCUMENT_GRANTS = token<DocumentGrants>('docs.DocumentGrants');

export const docsModule = defineContextModule({
  name: 'docs',
  register(builder) {
    builder
      .command(CreateDocument)
      .requires(docsPermissions['document.create'], {
        resource: (command) => ({ type: 'workspace', id: command.workspaceId }),
      })
      .handledBy(CreateDocumentHandler, [DOCUMENT_REPOSITORY, DOCUMENT_GRANTS, ID_GENERATOR]);
    builder
      .command(ShareDocument)
      .requires(docsPermissions['document.share'], {
        resource: (command) => ({ type: 'document', id: command.documentId }),
      })
      .handledBy(ShareDocumentHandler, [DOCUMENT_GRANTS]);
    builder
      .query(GetDocument)
      .requires(docsPermissions['document.view'], {
        resource: (query) => ({ type: 'document', id: query.documentId }),
      })
      .handledBy(GetDocumentHandler, [DOCUMENT_REPOSITORY]);
  },
});
