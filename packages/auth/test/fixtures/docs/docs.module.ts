import { defineContextModule } from '@ddd-ts-kit/di';
import { IdGenerator } from '@ddd-ts-kit/kernel';
import { docsPermissions } from './application/authorization/docs.permissions';
import { CreateDocument } from './application/commands/create-document/create-document.command';
import { CreateDocumentHandler } from './application/commands/create-document/create-document.handler';
import { ShareDocument } from './application/commands/share-document/share-document.command';
import { ShareDocumentHandler } from './application/commands/share-document/share-document.handler';
import { DocumentGrants } from './application/ports/document-grants.port';
import { GetDocument } from './application/queries/get-document/get-document.query';
import { GetDocumentHandler } from './application/queries/get-document/get-document.handler';
import { DocumentRepository } from './domain/repositories/document.repository';

export const docsModule = defineContextModule({
  name: 'docs',
  register(builder) {
    builder
      .command(CreateDocument)
      .requires(docsPermissions['document.create'], {
        resource: (command) => ({ type: 'workspace', id: command.workspaceId }),
      })
      .handledBy(CreateDocumentHandler, [DocumentRepository, DocumentGrants, IdGenerator]);

    builder
      .command(ShareDocument)
      .requires(docsPermissions['document.share'], {
        resource: (command) => ({ type: 'document', id: command.documentId }),
      })
      .handledBy(ShareDocumentHandler, [DocumentGrants]);

    builder
      .query(GetDocument)
      .requires(docsPermissions['document.view'], {
        resource: (query) => ({ type: 'document', id: query.documentId }),
      })
      .handledBy(GetDocumentHandler, [DocumentRepository]);
  },
});
