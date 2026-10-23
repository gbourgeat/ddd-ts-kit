import { NotFoundError } from '@ddd-ts-kit/kernel';
import type { Document } from '../../../domain/document';
import type { DocumentRepository } from '../../../domain/repositories/document.repository';
import type { GetDocument } from './get-document.query';

export class GetDocumentHandler {
  constructor(private readonly documents: DocumentRepository) {}

  async execute(query: GetDocument): Promise<Document> {
    const document = await this.documents.findById(query.documentId);

    if (document === undefined) {
      throw new NotFoundError('Document not found');
    }

    return document;
  }
}
