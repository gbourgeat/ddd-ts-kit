import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { MemberRemoved } from '{{alias.context}}/domain/events/member-removed.event{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';

/**
 * Once the removal is committed, the provider takes the person out of the organisation: their next token no longer names it. After the commit, at most once: a failure is reported and never undoes the decision of
 * the context, which stays the reference; the provider is brought back in line by a new decision.
 */
@DomainEventHandler(MemberRemoved, { name: MemberRemoved.eventName, phase: 'after-commit' })
export class MemberRemovedEventHandler implements DomainEventHandler<MemberRemoved> {
  constructor(private readonly identityProvider: IdentityProviderAdmin) {}

  async handle(event: MemberRemoved): Promise<void> {
    await this.identityProvider.removeMember(event.facts.organisationId, event.facts.accountId);
  }
}
