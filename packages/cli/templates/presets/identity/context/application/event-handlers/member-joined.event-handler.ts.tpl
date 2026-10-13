import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { MemberJoined } from '{{alias.context}}/domain/events/member-joined.event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * Once the membership is committed, the provider adds the person to the organisation: their next token names it. After the commit, at most once: a failure is reported and never undoes the decision of
 * the context, which stays the reference; the provider is brought back in line by a new decision.
 */
@DomainEventHandler(MemberJoined, { name: MemberJoined.eventName, phase: 'after-commit' })
export class MemberJoinedEventHandler implements DomainEventHandler<MemberJoined> {
  constructor(private readonly identityProvider: IdentityProviderAdmin) {}

  async handle(event: MemberJoined): Promise<void> {
    await this.identityProvider.addMember(event.facts.organisationId, event.facts.accountId);
  }
}
