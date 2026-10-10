import type { DocumentGrants } from '../../ports/document-grants.port.js';
import type { ShareDocument } from './share-document.command.js';

export class ShareDocumentHandler {
  constructor(private readonly grants: DocumentGrants) {}

  async execute(command: ShareDocument): Promise<void> {
    await this.grants.sharedWithGroup(command.documentId, command.groupId);
  }
}
