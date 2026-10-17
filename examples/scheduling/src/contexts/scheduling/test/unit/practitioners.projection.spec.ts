import { describe, expect, it } from 'vitest';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { AllowAll } from '@ddd-ts-kit/auth/testing';
import { Criteria, scoped } from '@ddd-ts-kit/kernel';
import { practiceMemberAddedV1, practiceMemberRemovedV1 } from '@/contexts/identity/published-language/index';
import type { PractitionerEntry } from '@/contexts/scheduling/application/ports/practitioner-directory.port';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

type Role = 'manager' | 'practitioner' | 'assistant';

describe('Practitioners known from identity', () => {
  it('knows a practitioner of a practice, with the time zone of the practice, once identity announces the member', async () => {
    const { application, practitioners } = await arrange();

    await application.eventBus.publish([added('event-1', 'practitioner')]);

    expect(await practitioners.get('practice-1.person-1')).toEqual({
      id: 'practice-1.person-1',
      practiceId: 'practice-1',
      practitionerId: 'person-1',
      displayName: 'Ada Martin',
      timeZone: 'Europe/Paris',
    });
  });

  it.each(['manager', 'assistant'] as const)('does not take a %s for a practitioner', async (role) => {
    const { application, practitioners } = await arrange();

    await application.eventBus.publish([added('event-1', role)]);

    expect(await practitioners.get('practice-1.person-1')).toBeUndefined();
  });

  it('forgets a practitioner removed from the practice', async () => {
    const { application, practitioners } = await arrange();

    await application.eventBus.publish([added('event-1', 'practitioner'), removed('event-2', 'practitioner')]);

    expect(await practitioners.get('practice-1.person-1')).toBeUndefined();
  });

  it('keeps the practitioner when the member removed held another role', async () => {
    const { application, practitioners } = await arrange();

    await application.eventBus.publish([added('event-1', 'practitioner'), removed('event-2', 'assistant')]);

    expect(await practitioners.get('practice-1.person-1')).toBeDefined();
  });

  it('does not bring back a removed practitioner when an older addition is delivered late', async () => {
    const { application, practitioners } = await arrange();

    await application.eventBus.publish([
      added('event-2', 'practitioner', at('08:00')),
      removed('event-3', 'practitioner', at('09:00')),
      added('event-1', 'practitioner', at('07:00')),
    ]);

    expect(await practitioners.get('practice-1.person-1')).toBeUndefined();
  });

  it('applies an addition delivered twice once', async () => {
    const { application, practitioners } = await arrange();

    await application.eventBus.publish([added('event-1', 'practitioner'), added('event-1', 'practitioner')]);

    expect(
      (await practitioners.search(scoped(Criteria.of<PractitionerEntry>(), { kind: 'all' }, {}))).items,
    ).toHaveLength(1);
  });

  it('knows again a practitioner added back after a removal', async () => {
    const { application, practitioners } = await arrange();

    await application.eventBus.publish([
      added('event-1', 'practitioner'),
      removed('event-2', 'practitioner'),
      added('event-3', 'practitioner', at('10:00')),
    ]);

    expect(await practitioners.get('practice-1.person-1')).toBeDefined();
  });
});

async function arrange() {
  const { application, practitionerDirectory } = await aSchedulingWorld({
    modules: [authorizationModule({ authorizer: new AllowAll() })],
  });

  await application.start();

  return { application, practitioners: practitionerDirectory };
}

function added(id: string, role: Role, occurredAt = at('08:00')) {
  return practiceMemberAddedV1.create(
    { practiceId: 'practice-1', personId: 'person-1', role, displayName: 'Ada Martin', timeZone: 'Europe/Paris' },
    { id, occurredAt },
  );
}

function removed(id: string, role: Role, occurredAt = at('09:00')) {
  return practiceMemberRemovedV1.create({ practiceId: 'practice-1', personId: 'person-1', role }, { id, occurredAt });
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
