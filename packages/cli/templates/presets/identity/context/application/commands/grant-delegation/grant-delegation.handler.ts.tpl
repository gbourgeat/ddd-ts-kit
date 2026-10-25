import type { Access } from '@ddd-ts-kit/auth';
import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import type { CommandHandler } from '@ddd-ts-kit/kernel';
{{/unless}}
import { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
{{#unless refusals.named}}
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { UnknownMember } from '{{alias.context}}/domain/errors/unknown-member.error{{alias.ext}}';
{{/if}}
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { RoleRightsService } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { DelegationPeriod } from '{{alias.context}}/domain/value-objects/delegation-period.vo{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{#if style.declared}}
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
{{/unless}}

{{#if style.declared}}
@CommandHandler(GrantDelegationCommand)
{{/if}}
export class GrantDelegationHandler implements CommandHandler<GrantDelegationCommand> {
  constructor(
    private readonly delegationRepository: DelegationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly access: Access,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** A member lends what their role grants, never what was lent to them, to another member of the organisation. */
  async execute({ actor, organisationId, terms }: GrantDelegationCommand): Promise<string> {
    const now = this.clock.now();
    const delegator = await this.memberRepository.findOf(organisationId, actor.id);
    const held = new RoleRightsService().rightsIn(organisationId, actor.id, { member: delegator, lent: [], now });

    await this.access.authorize(actor, {{context.camel}}Permissions['delegation.grant'], held);

    if ((await this.memberRepository.findOf(organisationId, terms.delegateId)) === undefined) {
{{#if refusals.named}}
      throw UnknownMember.forMembership(organisationId, terms.delegateId);
{{/if}}
{{#unless refusals.named}}
      throw MemberError.notFound(organisationId, terms.delegateId);
{{/unless}}
    }

    const period = DelegationPeriod.create(terms.startsAt, terms.endsAt);
    const lent = { organisationId, delegatorId: actor.id, delegateId: terms.delegateId, rights: terms.rights, period };
    const delegation = Delegation.grant(this.ids.next(), { ...lent, held }, now);

    await this.delegationRepository.save(delegation);

    return delegation.id;
  }
}
