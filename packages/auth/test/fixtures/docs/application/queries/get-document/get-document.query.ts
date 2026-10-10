import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import type { Document } from '../../../domain/document.js';

export class GetDocument extends AuthorizedQuery<Document> {
  constructor(
    actor: Actor,
    readonly documentId: string,
  ) {
    super(actor);
  }
}
