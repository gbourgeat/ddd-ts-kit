/**
 * What the application says about who relates to a document, in its own words. It knows
 * nothing of tuples, schemas or the authorization model.
 */
export abstract class DocumentGrants {
  abstract ownerAssigned(documentId: string, ownerId: string): Promise<void>;

  abstract sharedWithGroup(documentId: string, groupId: string): Promise<void>;
}
