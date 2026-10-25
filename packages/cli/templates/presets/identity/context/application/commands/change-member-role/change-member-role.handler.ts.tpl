import type { Access } from '@ddd-ts-kit/auth';
import type { Clock } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import type { CommandHandler } from '@ddd-ts-kit/kernel';
{{/unless}}
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
{{#unless refusals.named}}
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
import { OrganisationError } from '{{alias.context}}/domain/errors/organisation.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { UnknownMember } from '{{alias.context}}/domain/errors/unknown-member.error{{alias.ext}}';
import { UnknownOrganisation } from '{{alias.context}}/domain/errors/unknown-organisation.error{{alias.ext}}';
{{/if}}
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import type { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
import { RoleRightsService, type HeldRights } from '{{alias.context}}/domain/services/role-rights.service{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{#if style.declared}}
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
{{/unless}}

{{#if style.declared}}
@CommandHandler(ChangeMemberRoleCommand)
{{/if}}
export class ChangeMemberRoleHandler implements CommandHandler<ChangeMemberRoleCommand> {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly delegationRepository: DelegationRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  /**
   * Within the role of who decides, never on their own role. The organisation is saved with the
   * change, unchanged, so that its version orders the changes of its owners: two owners who
   * demote each other at once cannot both commit and leave it without one. The delegations the
   * member gave end with the role they were granted under: what they lent may no longer be theirs.
   */
  async execute({ actor, organisationId, accountId, role }: ChangeMemberRoleCommand): Promise<string> {
    const now = this.clock.now();
    const held = await this.heldBy(organisationId, actor.id, now);
    const rights = new RoleRightsService();

    await this.access.authorize(actor, {{context.camel}}Permissions['member.change-role'], rights.rightsIn(organisationId, actor.id, held));

    const { organisation, member } = await this.membershipIn(organisationId, accountId);
    const delegationId = rights.delegationUsedFor(MemberRight.ManageMembers, held);
    const owners = await this.memberRepository.countOwners(organisationId);

    member.changeRole(role, { by: held.member?.role ?? MemberRole.Member, byAccount: actor.id, delegationId, owners }, now);
    await this.organisationRepository.save(organisation);
    await this.memberRepository.save(member);
    await this.endDelegationsGivenBy(organisationId, accountId, now);

    return member.id;
  }

  private async heldBy(organisationId: string, accountId: string, now: Date): Promise<HeldRights> {
    const member = await this.memberRepository.findOf(organisationId, accountId);

    return { member, lent: await this.delegationRepository.findUnendedTo(organisationId, accountId), now };
  }

  /** The organisation, to be saved with the change, and the membership the change is about. */
  private async membershipIn(organisationId: string, accountId: string): Promise<{ organisation: Organisation; member: Member }> {
    const organisation = await this.organisationRepository.findById(organisationId);
    const member = await this.memberRepository.findOf(organisationId, accountId);

    if (organisation === undefined) {
{{#if refusals.named}}
      throw UnknownOrganisation.forOrganisation(organisationId);
{{/if}}
{{#unless refusals.named}}
      throw OrganisationError.notFound(organisationId);
{{/unless}}
    }

    if (member === undefined) {
{{#if refusals.named}}
      throw UnknownMember.forMembership(organisationId, accountId);
{{/if}}
{{#unless refusals.named}}
      throw MemberError.notFound(organisationId, accountId);
{{/unless}}
    }

    return { organisation, member };
  }

  private async endDelegationsGivenBy(organisationId: string, accountId: string, now: Date): Promise<void> {
    const involving = await this.delegationRepository.findUnendedInvolving(organisationId, accountId);

    for (const delegation of involving.filter((given) => given.delegatorId === accountId)) {
      delegation.end(now);
      await this.delegationRepository.save(delegation);
    }
  }
}
