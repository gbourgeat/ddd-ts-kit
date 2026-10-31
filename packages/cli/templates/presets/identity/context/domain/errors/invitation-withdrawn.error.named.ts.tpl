import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class InvitationWithdrawn extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvitationWithdrawn;

  static forInvitation(invitationId: string) {
    return InvitationWithdrawn.refusal(
      `The invitation ${invitationId} is withdrawn: its issuer may no longer invite in its role.`,
      { invitationId },
    );
  }
}
