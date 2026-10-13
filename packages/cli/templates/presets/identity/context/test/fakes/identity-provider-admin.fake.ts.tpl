import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/** The identity provider as a list of what it was asked, in order, failing on demand. */
export class FakeIdentityProviderAdmin implements IdentityProviderAdmin {
  readonly asked: string[] = [];

  private failure: Error | undefined;

  failWith(failure: Error): void {
    this.failure = failure;
  }

  async openOrganisation(organisation: { readonly id: string; readonly name: string }): Promise<void> {
    this.record(`open ${organisation.id} named ${organisation.name}`);
  }

  async addMember(organisationId: string, accountId: string): Promise<void> {
    this.record(`add ${accountId} to ${organisationId}`);
  }

  async removeMember(organisationId: string, accountId: string): Promise<void> {
    this.record(`remove ${accountId} from ${organisationId}`);
  }

  async disableAccount(accountId: string): Promise<void> {
    this.record(`disable ${accountId}`);
  }

  private record(request: string): void {
    if (this.failure !== undefined) {
      throw this.failure;
    }

    this.asked.push(request);
  }
}
