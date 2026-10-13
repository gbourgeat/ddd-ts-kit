import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { memberRemovedV1, type MemberRemovedV1 } from '{{alias.context}}/published-language/member-removed.v1.integration-event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * The provider takes the person out of the organisation: their next token no longer names it,
 * and with tenants they reach its data no more. Delivered at least once through the outbox, so a
 * provider down at the time of the removal is asked again until it answers; a person who joined
 * again since is left in, the context holding the membership now.
 */
@IntegrationEventHandler(memberRemovedV1, { consumer: '{{context.kebab}}.provider-follows-removed-member' })
export class MemberRemovedIntegrationHandler {
  static readonly eventType = memberRemovedV1.type;

  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly identityProvider: IdentityProviderAdmin,
  ) {}

  async handle(event: MemberRemovedV1): Promise<void> {
    const { organisationId, accountId } = event.payload;

    if ((await this.memberRepository.findOf(organisationId, accountId)) !== undefined) {
      return;
    }

    await this.identityProvider.removeMember(organisationId, accountId);
  }
}
