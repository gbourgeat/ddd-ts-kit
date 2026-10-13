/**
 * The administration API of the identity provider: it authenticates, and follows what this
 * context decides, so that its tokens name the organisations of each person and a deactivated
 * account signs in no more. Called by the consumers of the facts the context publishes through its
 * outbox (`application/integration/handlers/`), so at least once and in no guaranteed order: every
 * method is idempotent, and a failure is retried by whoever delivers the fact.
 */
export abstract class IdentityProviderAdmin {
  /** The provider knows the organisation under its slug, which its tokens then name. */
  abstract openOrganisation(organisation: { readonly id: string; readonly name: string }): Promise<void>;

  abstract addMember(organisationId: string, accountId: string): Promise<void>;

  abstract removeMember(organisationId: string, accountId: string): Promise<void>;

  abstract disableAccount(accountId: string): Promise<void>;
}
