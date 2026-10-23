import type { DocumentGrants } from '../../ports/document-grants.port';
import type { ShareDocument } from './share-document.command';

export class ShareDocumentHandler {
  constructor(private readonly grants: DocumentGrants) {}

  async execute(command: ShareDocument): Promise<void> {
    await this.grants.sharedWithGroup(command.documentId, command.groupId);
  }
}
