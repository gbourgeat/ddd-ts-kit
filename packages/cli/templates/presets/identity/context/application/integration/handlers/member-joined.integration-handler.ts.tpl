import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { memberJoinedV1, type MemberJoinedV1 } from '{{alias.context}}/published-language/member-joined.v1.integration-event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * The provider follows the membership: delivered at least once and in no guaranteed order, so the
 * handler brings the provider in line with what the context holds now rather than with the fact
 * alone. A membership already ended (removed, or its account deactivated) is taken out again,
 * so that a late retry of this fact never gives a removed person back their organisation.
 */
@IntegrationEventHandler(memberJoinedV1, { consumer: '{{context.kebab}}.provider-follows-joined-member' })
export class MemberJoinedIntegrationHandler {
  static readonly eventType = memberJoinedV1.type;

  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly identityProvider: IdentityProviderAdmin,
  ) {}

  async handle(event: MemberJoinedV1): Promise<void> {
    const { organisationId, accountId } = event.payload;
    const current = await this.memberRepository.findOf(organisationId, accountId);

    if (current === undefined) {
      await this.identityProvider.removeMember(organisationId, accountId);

      return;
    }

    await this.identityProvider.addMember(organisationId, accountId);
  }
}
