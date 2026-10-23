import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class InvitationNotPending extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvitationNotPending;

  static forInvitation(invitationId: string, status: string) {
    return InvitationNotPending.refusal(`The invitation ${invitationId} is already ${status}.`, {
      invitationId,
      status,
    }).exposing('status');
  }
}
