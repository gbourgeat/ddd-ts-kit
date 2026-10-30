import { AggregateRoot } from '@ddd-ts-kit/kernel';
{{#unless refusals.named}}
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { AboveOwnRole } from '{{alias.context}}/domain/errors/above-own-role.error{{alias.ext}}';
import { LastOwner } from '{{alias.context}}/domain/errors/last-owner.error{{alias.ext}}';
import { NotAnOwner } from '{{alias.context}}/domain/errors/not-an-owner.error{{alias.ext}}';
import { OwnRole } from '{{alias.context}}/domain/errors/own-role.error{{alias.ext}}';
import { UnknownMember } from '{{alias.context}}/domain/errors/unknown-member.error{{alias.ext}}';
{{/if}}
import { MemberJoined } from '{{alias.context}}/domain/events/member-joined.event{{alias.ext}}';
import { MemberRemoved } from '{{alias.context}}/domain/events/member-removed.event{{alias.ext}}';
import { MemberRoleChanged } from '{{alias.context}}/domain/events/member-role-changed.event{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export interface MemberState {
  readonly organisationId: string;
  readonly accountId: string;
  readonly role: MemberRole;
  readonly joinedAt: Date;
  readonly removedAt: Date | undefined;
}

/**
 * Who asks for a change of membership: their account and their own role (never the rights a
 * delegation lends them, so that nobody appoints above themselves), the delegation that lends
 * them the right when their role does not grant it, and how many owners the organisation has.
 */
export interface MembershipChange {
  readonly by: MemberRole;
  readonly byAccount: string;
  readonly delegationId: string | undefined;
  readonly owners: number;
}

/** The roles from the least to the most: a member appoints, changes and removes no one above their own role. */
const FROM_LEAST: readonly MemberRole[] = [MemberRole.Member, MemberRole.Admin, MemberRole.Owner];

/** The membership of one account in one organisation, in a role. */
export class Member extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: MemberState,
  ) {
    super(id);
  }

  static join(id: string, terms: Pick<MemberState, 'organisationId' | 'accountId' | 'role'>, now: Date): Member {
    const joined = new Member(id, { ...terms, joinedAt: now, removedAt: undefined });

    joined.record(new MemberJoined(id, now, terms));

    return joined;
  }

  static rehydrate(id: string, state: MemberState): Member {
    return new Member(id, state);
  }

  /** Whoever invites or appoints in `role` holds that role or a higher one: only an owner makes an owner. */
  static assertAppointable(organisationId: string, role: MemberRole, by: MemberRole): void {
    if (Member.mayAppoint(role, by)) {
      return;
    }

{{#if refusals.named}}
    throw role === MemberRole.Owner
      ? NotAnOwner.forOrganisation(organisationId)
      : AboveOwnRole.forOrganisation(organisationId);
{{/if}}
{{#unless refusals.named}}
    throw role === MemberRole.Owner ? MemberError.ownersOnly(organisationId) : MemberError.aboveOwnRole(organisationId);
{{/unless}}
  }

  /** Whether a member of the role `by` may invite or appoint in `role`, as `assertAppointable` decides. */
  static mayAppoint(role: MemberRole, by: MemberRole): boolean {
    return !outranks(role, by);
  }

  /** Never one's own role, never above one's own role, and the last owner stays one. */
  changeRole(role: MemberRole, change: MembershipChange, now: Date): void {
    this.assertActive();

    if (change.byAccount === this.state.accountId) {
{{#if refusals.named}}
      throw OwnRole.forOrganisation(this.state.organisationId);
{{/if}}
{{#unless refusals.named}}
      throw MemberError.ownRole(this.state.organisationId);
{{/unless}}
    }

    if (role === this.state.role) {
      return;
    }

    this.assertWithinRole(change.by, role);
    this.assertOwnersKept(change, role);

    const { organisationId, accountId, role: from } = this.state;

    this.state = { ...this.state, role };
    this.record(new MemberRoleChanged(this.id, now, { organisationId, accountId, from, to: role, ...under(change) }));
  }

  /** A member leaves, or is removed by someone of their role or above; the last owner stays. */
  remove(change: MembershipChange, now: Date): void {
    this.assertActive();

    if (change.byAccount !== this.state.accountId) {
      this.assertWithinRole(change.by, this.state.role);
    }

    this.assertOwnersKept(change, undefined);

    const { organisationId, accountId } = this.state;

    this.state = { ...this.state, removedAt: now };
    this.record(new MemberRemoved(this.id, now, { organisationId, accountId, ...under(change) }));
  }

  get isActive(): boolean {
    return this.state.removedAt === undefined;
  }

  get organisationId(): string {
    return this.state.organisationId;
  }

  get accountId(): string {
    return this.state.accountId;
  }

  get role(): MemberRole {
    return this.state.role;
  }

  get joinedAt(): Date {
    return this.state.joinedAt;
  }

  toState(): MemberState {
    return { ...this.state };
  }

  private assertActive(): void {
    if (!this.isActive) {
{{#if refusals.named}}
      throw UnknownMember.forMembership(this.state.organisationId, this.state.accountId);
{{/if}}
{{#unless refusals.named}}
      throw MemberError.notFound(this.state.organisationId, this.state.accountId);
{{/unless}}
    }
  }

  /** The role the member holds, and the one they are given, are both within the role of who decides. */
  private assertWithinRole(by: MemberRole, next: MemberRole): void {
    Member.assertAppointable(this.state.organisationId, this.state.role, by);
    Member.assertAppointable(this.state.organisationId, next, by);
  }

  /** `next` is the role after the change, none for a removal. */
  private assertOwnersKept(change: MembershipChange, next: MemberRole | undefined): void {
    if (this.state.role === MemberRole.Owner && next !== MemberRole.Owner && change.owners <= 1) {
{{#if refusals.named}}
      throw LastOwner.forOrganisation(this.state.organisationId);
{{/if}}
{{#unless refusals.named}}
      throw MemberError.lastOwner(this.state.organisationId);
{{/unless}}
    }
  }
}

function outranks(role: MemberRole, other: MemberRole): boolean {
  return FROM_LEAST.indexOf(role) > FROM_LEAST.indexOf(other);
}

/** The delegation a change was decided under, named in its fact so that the trail says whose rights were used. */
function under(change: MembershipChange): { readonly delegationId?: string } {
  return change.delegationId === undefined ? {} : { delegationId: change.delegationId };
}
