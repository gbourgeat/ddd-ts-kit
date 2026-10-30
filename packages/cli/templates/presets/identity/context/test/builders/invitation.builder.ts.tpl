import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

interface InvitationIngredients {
  readonly id: string;
  readonly organisationId: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly delegationId: string | undefined;
  readonly issuedAt: Date;
}

export class InvitationBuilder extends Builder<InvitationIngredients, Invitation> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  to(organisationId: string): this {
    return this.with('organisationId', organisationId);
  }

  addressedTo(email: string): this {
    return this.with('email', email);
  }

  as(role: MemberRole): this {
    return this.with('role', role);
  }

  issuedBy(accountId: string): this {
    return this.with('invitedBy', accountId);
  }

  /** Issued under that delegation, which lent the right to invite. */
  under(delegationId: string): this {
    return this.with('delegationId', delegationId);
  }

  withTokenHash(tokenHash: string): this {
    return this.with('tokenHash', tokenHash);
  }

  issuedAt(instant: Date): this {
    return this.with('issuedAt', instant);
  }

  protected defaults(): Defaults<InvitationIngredients> {
    return {
      id: sequence('invitation'),
      organisationId: 'acme',
      email: 'grace@example.test',
      role: MemberRole.Member,
      tokenHash: sequence('digest'),
      invitedBy: 'account-founder',
      delegationId: undefined,
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  protected construct({ id, email, issuedAt, delegationId, ...terms }: InvitationIngredients): Invitation {
    const under = delegationId === undefined ? {} : { delegationId };

    return Invitation.issue(id, { ...terms, ...under, email: EmailAddress.create(email) }, issuedAt);
  }
}

export function anInvitation(): InvitationBuilder {
  return new InvitationBuilder();
}
