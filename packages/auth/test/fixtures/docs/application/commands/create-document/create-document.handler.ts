import type { IdGenerator } from '@ddd-ts-kit/kernel';
import type { DocumentRepository } from '../../../domain/repositories/document.repository.js';
import type { DocumentGrants } from '../../ports/document-grants.port.js';
import type { CreateDocument } from './create-document.command.js';

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
