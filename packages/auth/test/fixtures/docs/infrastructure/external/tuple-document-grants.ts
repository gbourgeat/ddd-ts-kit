import type { RelationTupleStore } from '../../../../../src/rebac.js';
import type { DocumentGrants } from '../../application/ports/document-grants.port.js';
import type { StagingUnitOfWork } from '../persistence/staging-unit-of-work.js';

/**
 * The adapter that knows the model. With a SQL tuple store it writes in the transaction the
 * unit of work opened.
 */
export class TupleDocumentGrants implements DocumentGrants {
  constructor(
    private readonly unitOfWork: StagingUnitOfWork,
    private readonly tuples: RelationTupleStore,
  ) {}

  async ownerAssigned(documentId: string, ownerId: string): Promise<void> {
    this.write(`document:${documentId}`, 'owner', `user:${ownerId}`);
  }

  async sharedWithGroup(documentId: string, groupId: string): Promise<void> {
    this.write(`document:${documentId}`, 'viewer', `group:${groupId}#member`);
  }

  private write(object: string, relation: string, subject: string): void {
    this.unitOfWork.enlist(() => this.tuples.write([{ object, relation, subject }]));
  }
}
