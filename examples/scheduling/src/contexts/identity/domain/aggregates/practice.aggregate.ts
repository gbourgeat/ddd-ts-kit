import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { AlreadyMemberError } from '../errors/already-member.error.js';
import { NotAMemberError } from '../errors/not-a-member.error.js';
import { NotAPractitionerError } from '../errors/not-a-practitioner.error.js';
import { NotAnAssistantError } from '../errors/not-an-assistant.error.js';
import { PracticeLeftUnmanagedError } from '../errors/practice-left-unmanaged.error.js';
import { PracticeMemberAdded } from '../events/practice-member-added.event.js';
import { PracticeMemberRemoved } from '../events/practice-member-removed.event.js';
import { PracticeOpened } from '../events/practice-opened.event.js';
import { Desk } from '../value-objects/desk.vo.js';
import type { DisplayName } from '../value-objects/display-name.vo.js';
import { Membership } from '../value-objects/membership.vo.js';
import { Role } from '../value-objects/role.vo.js';
import type { TimeZone } from '../value-objects/time-zone.vo.js';

export interface PracticeState {
  readonly registeredAt: Date;
  readonly name: string;
  readonly timeZone: TimeZone;
  readonly members: readonly Membership[];
}

/** The person who joins, the role they take and the name they are known by on that day. */
interface Newcomer {
  readonly personId: string;
  readonly role: Role;
  readonly displayName: DisplayName;
}

/** What is known when a practice opens; its first manager is a registered person. */
interface Opening {
  readonly name: string;
  readonly timeZone: TimeZone;
  readonly manager: Omit<Newcomer, 'role'>;
}

export class Practice extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: PracticeState,
  ) {
    super(id);
  }

  static create(id: string, opening: Opening, now: Date): Practice {
    const created = new Practice(id, {
      registeredAt: now,
      name: opening.name.trim(),
      timeZone: opening.timeZone,
      members: [],
    });

    const facts = { name: created.state.name, timeZone: opening.timeZone.value, managerId: opening.manager.personId };

    created.record(new PracticeOpened(id, now, facts));
    created.addMember({ ...opening.manager, role: Role.manager() }, now);

    return created;
  }

  static rehydrate(id: string, state: PracticeState): Practice {
    return new Practice(id, state);
  }

  addMember(newcomer: Newcomer, now: Date): void {
    if (this.membershipOf(newcomer.personId) !== undefined) {
      throw new AlreadyMemberError(newcomer.personId);
    }

    const membership = Membership.create(newcomer.personId, newcomer.role);

    const facts = {
      personId: membership.personId,
      role: membership.role,
      displayName: newcomer.displayName.value,
      timeZone: this.state.timeZone.value,
    };

    this.state = { ...this.state, members: [...this.state.members, membership] };
    this.record(new PracticeMemberAdded(this.id, now, facts));
  }

  removeMember(personId: string, now: Date): void {
    const leaving = this.membershipOf(personId);

    if (leaving === undefined) {
      throw new NotAMemberError(personId);
    }

    const remaining = this.state.members.filter((member) => !member.isOf(personId));

    if (leaving.has('manager') && !remaining.some((member) => member.has('manager'))) {
      throw new PracticeLeftUnmanagedError();
    }

    this.state = { ...this.state, members: remaining };
    this.record(new PracticeMemberRemoved(this.id, now, { personId, role: leaving.role }));
  }

  /** The desk a delegation is given on: the post of one of the practitioners of this practice. */
  deskOf(practitionerId: string): Desk {
    if (this.membershipOf(practitionerId)?.has('practitioner') !== true) {
      throw new NotAPractitionerError(practitionerId);
    }

    return Desk.create(this.id, practitionerId);
  }

  /** The assistant of this practice a delegation may be given to. */
  assistant(assistantId: string): Membership {
    const membership = this.membershipOf(assistantId);

    if (membership?.has('assistant') !== true) {
      throw new NotAnAssistantError(assistantId);
    }

    return membership;
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get name(): string {
    return this.state.name;
  }

  get timeZone(): TimeZone {
    return this.state.timeZone;
  }

  get members(): readonly Membership[] {
    return this.state.members;
  }

  toState(): PracticeState {
    return { ...this.state };
  }

  private membershipOf(personId: string): Membership | undefined {
    return this.state.members.find((member) => member.isOf(personId));
  }
}
