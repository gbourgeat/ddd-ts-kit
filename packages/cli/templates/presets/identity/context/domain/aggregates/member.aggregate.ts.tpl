import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { MemberError } from '{{alias.context}}/domain/errors/member.error{{alias.ext}}';
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

/** Who asks for a change of membership, and how many owners the organisation has: an organisation keeps one owner at least. */
export interface MembershipChange {
  readonly by: MemberRole;
  readonly owners: number;
}

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

  /** Only an owner appoints an owner or changes the role of one, and the last owner stays one. */
  changeRole(role: MemberRole, change: MembershipChange, now: Date): void {
    this.assertActive();

    if (role === this.state.role) {
      return;
    }

    this.assertOwnersKept(change, role);

    const { organisationId, accountId, role: from } = this.state;

    this.state = { ...this.state, role };
    this.record(new MemberRoleChanged(this.id, now, { organisationId, accountId, from, to: role }));
  }

  /** Only an owner removes an owner, and the last owner stays. */
  remove(change: MembershipChange, now: Date): void {
    this.assertActive();
    this.assertOwnersKept(change, undefined);

    const { organisationId, accountId } = this.state;

    this.state = { ...this.state, removedAt: now };
    this.record(new MemberRemoved(this.id, now, { organisationId, accountId }));
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
      throw MemberError.notFound(this.state.organisationId, this.state.accountId);
    }
  }

  /** `next` is the role after the change, none for a removal. */
  private assertOwnersKept(change: MembershipChange, next: MemberRole | undefined): void {
    const touchesAnOwner = this.state.role === MemberRole.Owner || next === MemberRole.Owner;

    if (touchesAnOwner && change.by !== MemberRole.Owner) {
      throw MemberError.ownersOnly(this.state.organisationId);
    }

    if (this.state.role === MemberRole.Owner && next !== MemberRole.Owner && change.owners <= 1) {
      throw MemberError.lastOwner(this.state.organisationId);
    }
  }
}
