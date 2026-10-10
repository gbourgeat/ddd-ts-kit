import { ConflictError } from '@ddd-ts-kit/kernel';
import type { Document } from '../../domain/document.js';
import type { DocumentRepository } from '../../domain/repositories/document.repository.js';
import type { StagingUnitOfWork } from './staging-unit-of-work.js';

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
