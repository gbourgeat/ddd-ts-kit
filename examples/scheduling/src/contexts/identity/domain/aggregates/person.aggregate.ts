import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { PersonRegistered } from '@/contexts/identity/domain/events/person-registered.event.js';
import type { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo.js';
import type { Email } from '@/contexts/identity/domain/value-objects/email.vo.js';

export interface PersonState {
  readonly registeredAt: Date;
  readonly displayName: DisplayName;
  readonly email: Email;
}

export class Person extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: PersonState,
  ) {
    super(id);
  }

  static create(id: string, contact: Pick<PersonState, 'displayName' | 'email'>, now: Date): Person {
    const created = new Person(id, { registeredAt: now, displayName: contact.displayName, email: contact.email });

    created.record(
      new PersonRegistered(id, now, { displayName: contact.displayName.value, email: contact.email.value }),
    );

    return created;
  }

  static rehydrate(id: string, state: PersonState): Person {
    return new Person(id, state);
  }

  /** A person who registers again is the same person: the name and the address follow, nothing new is announced. */
  registerAgain(contact: Pick<PersonState, 'displayName' | 'email'>): void {
    this.state = { ...this.state, displayName: contact.displayName, email: contact.email };
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get displayName(): DisplayName {
    return this.state.displayName;
  }

  get email(): Email {
    return this.state.email;
  }

  toState(): PersonState {
    return { ...this.state };
  }
}
