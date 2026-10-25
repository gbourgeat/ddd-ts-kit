import type { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import type { CommandHandler } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#unless refusals.named}}
import { DelegationError } from '{{alias.context}}/domain/errors/delegation.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { UnknownDelegation } from '{{alias.context}}/domain/errors/unknown-delegation.error{{alias.ext}}';
{{/if}}
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{#if style.declared}}
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
{{/unless}}

{{#if style.declared}}
@CommandHandler(RevokeDelegationCommand)
{{/if}}
export class RevokeDelegationHandler implements CommandHandler<RevokeDelegationCommand> {
  constructor(
    private readonly delegationRepository: DelegationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /** Whoever may grant delegations in the organisation revokes them; one of another organisation is not found here. */
  async execute({ actor, organisationId, delegationId }: RevokeDelegationCommand): Promise<string> {
    const now = this.clock.now();
    const member = await this.memberRepository.findOf(organisationId, actor.id);
    const rights = new RoleRightsService().rightsIn(organisationId, actor.id, { member, lent: [], now });

    await this.access.authorize(actor, {{context.camel}}Permissions['delegation.revoke'], rights);

    const delegation = await this.delegationRepository.findById(delegationId);

    if (delegation?.organisationId !== organisationId) {
{{#if refusals.named}}
      throw UnknownDelegation.forDelegation(delegationId);
{{/if}}
{{#unless refusals.named}}
      throw DelegationError.notFound(delegationId);
{{/unless}}
    }

    delegation.revoke(now);
    await this.delegationRepository.save(delegation);

    return delegation.id;
  }
}
