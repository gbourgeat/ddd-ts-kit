import type { Document } from '../document.js';

export abstract class DocumentRepository {
  abstract findById(id: string): Promise<Document | undefined>;

  abstract save(document: Document): Promise<void>;
}
