import type { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationError } from '{{alias.context}}/domain/errors/delegation.error{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';

@CommandHandler(RevokeDelegationCommand)
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
      throw DelegationError.notFound(delegationId);
    }

    delegation.revoke(now);
    await this.delegationRepository.save(delegation);

    return delegation.id;
  }
}
