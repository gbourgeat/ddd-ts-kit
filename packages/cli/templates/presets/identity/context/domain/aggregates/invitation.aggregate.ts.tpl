import { AggregateRoot } from '@ddd-ts-kit/kernel';
{{#unless refusals.named}}
import { InvitationError } from '{{alias.context}}/domain/errors/invitation.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { InvitationExpired } from '{{alias.context}}/domain/errors/invitation-expired.error{{alias.ext}}';
import { InvitationNotAddressedToAccount } from '{{alias.context}}/domain/errors/invitation-not-addressed-to-account.error{{alias.ext}}';
import { InvitationNotPending } from '{{alias.context}}/domain/errors/invitation-not-pending.error{{alias.ext}}';
{{/if}}
import { InvitationAccepted } from '{{alias.context}}/domain/events/invitation-accepted.event{{alias.ext}}';
import { InvitationDeclined } from '{{alias.context}}/domain/events/invitation-declined.event{{alias.ext}}';
import { InvitationIssued } from '{{alias.context}}/domain/events/invitation-issued.event{{alias.ext}}';
import { InvitationRevoked } from '{{alias.context}}/domain/events/invitation-revoked.event{{alias.ext}}';
import type { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { InvitationStatus } from '{{alias.context}}/domain/vocabularies/invitation-status.vocabulary{{alias.ext}}';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** How long an invitation can be answered: a week, then a new one is sent. */
const VALIDITY_MS = 7 * 86_400_000;

export interface InvitationState {
  readonly organisationId: string;
  readonly email: EmailAddress;
  readonly role: MemberRole;
  /** The digest of the token sent to the person: the token itself is never stored. */
  readonly tokenHash: string;
  readonly invitedBy: string;
  /** The delegation that lent the right to invite, when the role of the inviter did not grant it. */
  readonly delegationId: string | undefined;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly status: InvitationStatus;
  readonly answeredAt: Date | undefined;
}

/** What an invitation is issued with. */
export type InvitationTerms = Pick<InvitationState, 'organisationId' | 'email' | 'role' | 'tokenHash' | 'invitedBy'> & {
  readonly delegationId?: string;
};

/** The person who answers an invitation: an account, with the email address its provider knows. */
export interface Invitee {
  readonly id: string;
  readonly email: EmailAddress;
}

/** An organisation asks a person, by email address, to join it in a role; the answer is theirs alone. */
export class Invitation extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: InvitationState,
  ) {
    super(id);
  }

  /** `delegationId` names the delegation that lent the right to invite, when the role of the inviter does not grant it. */
  static issue(id: string, terms: InvitationTerms, now: Date): Invitation {
    const expiresAt = new Date(now.getTime() + VALIDITY_MS);
    const pending = { status: InvitationStatus.Pending, issuedAt: now, expiresAt, answeredAt: undefined };
    const { organisationId, email, role, tokenHash, invitedBy, delegationId } = terms;
    const issued = new Invitation(id, { organisationId, email, role, tokenHash, invitedBy, delegationId, ...pending });
    const under = delegationId === undefined ? {} : { delegationId };

    issued.record(new InvitationIssued(id, now, { organisationId, email: email.value, role, expiresAt, ...under }));

    return issued;
  }

  static rehydrate(id: string, state: InvitationState): Invitation {
    return new Invitation(id, state);
  }

  /** By the person it was addressed to, before it expires: they become a member (see `AcceptInvitationHandler`). */
  accept(invitee: Invitee, now: Date): void {
    this.assertAnswerableBy(invitee, now);
    this.answer(InvitationStatus.Accepted, now);
    this.record(new InvitationAccepted(this.id, now, { organisationId: this.organisationId, accountId: invitee.id }));
  }

  decline(invitee: Invitee, now: Date): void {
    this.assertAnswerableBy(invitee, now);
    this.answer(InvitationStatus.Declined, now);
    this.record(new InvitationDeclined(this.id, now, { organisationId: this.organisationId }));
  }

  /** Taken back by the organisation while it waits for an answer, expired or not. */
  revoke(now: Date): void {
    if (this.state.status !== InvitationStatus.Pending) {
{{#if refusals.named}}
      throw InvitationNotPending.forInvitation(this.id, this.state.status);
{{/if}}
{{#unless refusals.named}}
      throw InvitationError.notPending(this.id, this.state.status);
{{/unless}}
    }

    this.answer(InvitationStatus.Revoked, now);
    this.record(new InvitationRevoked(this.id, now, { organisationId: this.organisationId }));
  }

  get organisationId(): string {
    return this.state.organisationId;
  }

  get email(): EmailAddress {
    return this.state.email;
  }

  get role(): MemberRole {
    return this.state.role;
  }

  /** The account that issued it: the invitation holds while that account may still invite in its role (`RoleRightsService.mayStillIssue`). */
  get invitedBy(): string {
    return this.state.invitedBy;
  }

  /** The delegation it was issued under: it holds while that delegation does, whatever else is lent to the inviter. */
  get delegationId(): string | undefined {
    return this.state.delegationId;
  }

  get status(): InvitationStatus {
    return this.state.status;
  }

  get expiresAt(): Date {
    return this.state.expiresAt;
  }

  toState(): InvitationState {
    return { ...this.state };
  }

  private assertAnswerableBy(invitee: Invitee, now: Date): void {
    if (this.state.status !== InvitationStatus.Pending) {
{{#if refusals.named}}
      throw InvitationNotPending.forInvitation(this.id, this.state.status);
{{/if}}
{{#unless refusals.named}}
      throw InvitationError.notPending(this.id, this.state.status);
{{/unless}}
    }

    if (now.getTime() >= this.state.expiresAt.getTime()) {
{{#if refusals.named}}
      throw InvitationExpired.forInvitation(this.id, this.state.expiresAt);
{{/if}}
{{#unless refusals.named}}
      throw InvitationError.expired(this.id, this.state.expiresAt);
{{/unless}}
    }

    if (!invitee.email.equals(this.state.email)) {
{{#if refusals.named}}
      throw InvitationNotAddressedToAccount.forInvitation(this.id);
{{/if}}
{{#unless refusals.named}}
      throw InvitationError.addressedToAnother(this.id);
{{/unless}}
    }
  }

  private answer(status: InvitationStatus, now: Date): void {
    this.state = { ...this.state, status, answeredAt: now };
  }
}
