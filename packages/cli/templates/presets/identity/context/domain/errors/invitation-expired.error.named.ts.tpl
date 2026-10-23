import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class InvitationExpired extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvitationExpired;

  static forInvitation(invitationId: string, expiresAt: Date) {
    return InvitationExpired.refusal(`The invitation ${invitationId} expired.`, {
      invitationId,
      expiresAt,
    }).exposing('expiresAt');
  }
}
