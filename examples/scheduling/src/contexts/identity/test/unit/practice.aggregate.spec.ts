import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { given } from '@ddd-ts-kit/testing';
import { Practice } from '../../domain/aggregates/practice.aggregate.js';
import { AlreadyMemberError } from '../../domain/errors/already-member.error.js';
import { NotAMemberError } from '../../domain/errors/not-a-member.error.js';
import { NotAPractitionerError } from '../../domain/errors/not-a-practitioner.error.js';
import { NotAnAssistantError } from '../../domain/errors/not-an-assistant.error.js';
import { PracticeLeftUnmanagedError } from '../../domain/errors/practice-left-unmanaged.error.js';
import { DisplayName } from '../../domain/value-objects/display-name.vo.js';
import { Role, type RoleName } from '../../domain/value-objects/role.vo.js';
import { aPractice } from '../builders/practice.builder.js';

const later = new Date('2026-02-01T00:00:00.000Z');

describe('Practice', () => {
  it('is born with its identity', () => {
    const bornAt = new Date('2026-03-01T00:00:00.000Z');

    const born = aPractice().identifiedBy('practice-7').bornAt(bornAt).build();

    expect(born.id).toBe('practice-7');
    expect(born.registeredAt).toEqual(bornAt);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = aPractice().build();

    const loaded = Practice.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('opens in its time zone with its first manager as a member', () => {
    const bornAt = new Date('2026-03-01T00:00:00.000Z');

    const opened = aPractice().identifiedBy('practice-7').named('Riverside').inTimeZone('Europe/Paris').managedBy('person-1').bornAt(bornAt).build();

    expect(opened.members.map((member) => [member.personId, member.role])).toEqual([['person-1', 'manager']]);

    expect(opened.pullEvents()).toEqual([
      { name: 'identity.practice.opened', aggregateId: 'practice-7', occurredAt: bornAt, facts: { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'person-1' } },
      {
        name: 'identity.practice.member-added',
        aggregateId: 'practice-7',
        occurredAt: bornAt,
        facts: { personId: 'person-1', role: 'manager', displayName: 'Name of person-1', timeZone: 'Europe/Paris' },
      },
    ]);
  });

  it('adds a member with their role and announces it with their name and the time zone of the practice', () => {
    given(aPractice().identifiedBy('practice-7').inTimeZone('Europe/Paris'))
      .when((practice) => practice.addMember(newcomer('person-2', 'practitioner'), later))
      .thenEvents([
        {
          name: 'identity.practice.member-added',
          aggregateId: 'practice-7',
          occurredAt: later,
          facts: { personId: 'person-2', role: 'practitioner', displayName: 'Grace Hopper', timeZone: 'Europe/Paris' },
        },
      ])
      .thenState((practice) => expect(practice.members).toHaveLength(2));
  });

  it('refuses to add a person who is already a member, whatever the role asked', () => {
    given(aPractice().withPractitioner('person-2'))
      .when((practice) => practice.addMember(newcomer('person-2', 'assistant'), later))
      .thenError(AlreadyMemberError, 'ALREADY_MEMBER');
  });

  it('removes a member and announces it with the role they had', () => {
    given(aPractice().identifiedBy('practice-7').withAssistant('person-3'))
      .when((practice) => practice.removeMember('person-3', later))
      .thenEvents([{ name: 'identity.practice.member-removed', aggregateId: 'practice-7', occurredAt: later, facts: { personId: 'person-3', role: 'assistant' } }])
      .thenState((practice) => expect(practice.members).toHaveLength(1));
  });

  it('refuses to remove someone who is not a member', () => {
    given(aPractice())
      .when((practice) => practice.removeMember('stranger', later))
      .thenError(NotAMemberError, 'NOT_A_MEMBER');
  });

  it('refuses to remove its last manager', () => {
    given(aPractice().managedBy('person-1').withPractitioner('person-2'))
      .when((practice) => practice.removeMember('person-1', later))
      .thenError(PracticeLeftUnmanagedError, 'LAST_MANAGER');
  });

  it('lets a manager go as long as another one remains', () => {
    given(aPractice().managedBy('person-1').withManager('person-4'))
      .when((practice) => practice.removeMember('person-1', later))
      .thenEventNames(['identity.practice.member-removed']);
  });

  it('names the desk of one of its practitioners', () => {
    const practice = aPractice().identifiedBy('practice-7').withPractitioner('person-2').build();

    const desk = practice.deskOf('person-2');

    expect([desk.practiceId, desk.practitionerId]).toEqual(['practice-7', 'person-2']);
  });

  it.each(['person-1', 'person-3', 'stranger'])('has no desk for %s, who is not one of its practitioners', (personId) => {
    given(aPractice().managedBy('person-1').withAssistant('person-3'))
      .when((practice) => practice.deskOf(personId))
      .thenError(NotAPractitionerError, 'NOT_A_PRACTITIONER');
  });

  it('knows its assistants', () => {
    const practice = aPractice().withAssistant('person-3').build();

    expect(practice.assistant('person-3').personId).toBe('person-3');
  });

  it.each(['person-1', 'person-2', 'stranger'])('does not take %s for one of its assistants', (personId) => {
    given(aPractice().managedBy('person-1').withPractitioner('person-2'))
      .when((practice) => practice.assistant(personId))
      .thenError(NotAnAssistantError, 'NOT_AN_ASSISTANT');
  });
});

function newcomer(personId: string, role: RoleName) {
  return { personId, role: unwrap(Role.create(role)), displayName: unwrap(DisplayName.create('Grace Hopper')) };
}
