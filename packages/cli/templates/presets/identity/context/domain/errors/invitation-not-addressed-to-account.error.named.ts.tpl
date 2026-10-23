import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class InvitationNotAddressedToAccount extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvitationNotAddressedToAccount;

  static forInvitation(invitationId: string) {
    return InvitationNotAddressedToAccount.refusal(
      `The invitation ${invitationId} is addressed to another email address than the account's.`,
      { invitationId },
    );
  }
}
