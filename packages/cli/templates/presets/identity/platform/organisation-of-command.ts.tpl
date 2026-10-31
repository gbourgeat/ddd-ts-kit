import type { Message } from '@ddd-ts-kit/kernel';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { OrganisationSlug } from '{{alias.context}}/domain/value-objects/organisation-slug.vo{{alias.ext}}';

/**
 * The organisation a command of the {{context.kebab}} context acts on, whose audit chain receives its
 * entry once it succeeded, whatever organisation the token of its sender names: the owner of an
 * organisation reads there who opened it, invited, removed, changed a role or lent a right in it.
 * The entry of a failure, and the decision of the authorization, stay in the tenant of the token,
 * since they record what the sender asked. Accepting or declining an invitation names its token
 * only: the organisation it joins reads `{{context.kebab}}.member.joined` in its own chain.
 */
export function organisationOfCommand(message: Message): string | undefined {
  if (message instanceof OpenOrganisationCommand) {
    return OrganisationSlug.create(message.organisation.slug).value;
  }

  if (
    message instanceof ChangeMemberRoleCommand ||
    message instanceof GrantDelegationCommand ||
    message instanceof InviteMemberCommand ||
    message instanceof RemoveMemberCommand ||
    message instanceof RevokeDelegationCommand ||
    message instanceof RevokeInvitationCommand
  ) {
    return message.organisationId;
  }

  return undefined;
}
