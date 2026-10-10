import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import {
  delegationRevokedV1,
  type DelegationRevokedV1Payload,
  practiceMemberRemovedV1,
  type PracticeMemberRemovedV1Payload,
} from '@/contexts/identity/published-language/index.js';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application.js';
import { storyOf } from '$test/e2e/support/story-of.js';

describe('Remove member, end to end', () => {
  const tracing = installTestTracing();
  let application: RunningApplication;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
    tracing.uninstall();
  });

  beforeEach(async () => {
    await application.reset();
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('answers 401 to a caller who presents no credential', async () => {
    const response = await application.client.delete('/practices/practice-id-1/members/person-id-1');

    expectStatus(response, 401);
  });

  it('answers 403 to a member who does not manage the practice', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const grace = await application.as({ id: 'grace' });

    const response = await grace.delete('/practices/' + practiceId + '/members/linus');

    expectStatus(response, 403);
  });

  it('is one trace: the request, the use case, what it saves and what follows the fact, the delegation it ends included', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const grace = await application.as({ id: 'grace' });

    expectStatus(
      await grace.post('/practices/' + practiceId + '/desks/grace/delegations', {
        assistantId: 'linus',
        availabilityIncluded: false,
      }),
      201,
    );

    const ada = await application.as({ id: 'ada' });

    const trace = await tracing.traceOf(async () => {
      expectStatus(await ada.delete('/practices/' + practiceId + '/members/linus'), 200);
    });

    // The relay is still publishing what the arrangement announced: only the trace of the request is told here.
    expectSpanTree(
      storyOf(trace).filter((span) => span.kind === 'SERVER'),
      storyOfTheRequest,
    );
  });

  it('answers 200 to DELETE /practices/:practiceId/members/:personId for a manager, and the practitioner removed no longer holds their desk', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const ada = await application.as({ id: 'ada' });

    const removed = expectStatus(await ada.delete<{ id: string }>('/practices/' + practiceId + '/members/grace'), 200);

    const grace = await application.as({ id: 'grace' });

    expect(removed.body.id).toBe('grace');

    expectStatus(
      await grace.post('/practices/' + practiceId + '/desks/grace/delegations', {
        assistantId: 'linus',
        availabilityIncluded: false,
      }),
      403,
    );
  });

  it('publishes that the member is removed and that their delegations are revoked for that cause', async () => {
    const events = collectEvents(application.events, [practiceMemberRemovedV1, delegationRevokedV1]);
    const practiceId = await openPracticeWithMembers(application);
    const grace = await application.as({ id: 'grace' });

    const granted = expectStatus(
      await grace.post<{ id: string }>('/practices/' + practiceId + '/desks/grace/delegations', {
        assistantId: 'linus',
        availabilityIncluded: true,
      }),
      201,
    );

    const ada = await application.as({ id: 'ada' });

    expectStatus(await ada.delete('/practices/' + practiceId + '/members/linus'), 200);

    const left = await events.waitFor<PracticeMemberRemovedV1Payload>(
      practiceMemberRemovedV1,
      (event) => event.payload.personId === 'linus',
    );

    const revoked = await events.waitFor<DelegationRevokedV1Payload>(
      delegationRevokedV1,
      (event) => event.payload.delegationId === granted.body.id,
    );

    expect(left.payload).toEqual({ practiceId, personId: 'linus', role: 'assistant' });
    expect(revoked.payload).toMatchObject({ practitionerId: 'grace', assistantId: 'linus', cause: 'member-removed' });
    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const ada = await application.as({ id: 'ada' });

    expectProblem(await ada.delete('/practices/' + practiceId + '/members/ada'), { status: 409, code: 'LAST_MANAGER' });

    expectProblem(await ada.delete('/practices/' + practiceId + '/members/nobody'), {
      status: 422,
      code: 'NOT_A_MEMBER',
    });
  });
});

/** A practice opened by the platform admin and managed by ada, with grace as a practitioner and linus as an assistant; answers its identifier. */
async function openPracticeWithMembers(application: RunningApplication): Promise<string> {
  await register(application, 'ada', 'grace', 'linus');

  const root = await application.as({ id: 'root', roles: ['platform-admin'] });

  const opened = expectStatus(
    await root.post<{ id: string }>('/practices', { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' }),
    201,
  );

  const ada = await application.as({ id: 'ada' });

  expectStatus(
    await ada.post('/practices/' + opened.body.id + '/members', { personId: 'grace', role: 'practitioner' }),
    201,
  );

  expectStatus(
    await ada.post('/practices/' + opened.body.id + '/members', { personId: 'linus', role: 'assistant' }),
    201,
  );

  return opened.body.id;
}

/** Each person registers themselves, as at their first sign-in. */
async function register(application: RunningApplication, ...personIds: readonly string[]): Promise<void> {
  for (const personId of personIds) {
    const person = await application.as({ id: personId });

    expectStatus(
      await person.put('/people/me', { displayName: 'Name of ' + personId, email: personId + '@example.com' }),
      200,
    );
  }
}

const storyOfTheRequest: Parameters<typeof expectSpanTree>[1] = [
  {
    name: 'DELETE /practices/:practiceId/members/:personId',
    kind: 'SERVER',
    children: [
      {
        name: 'command RemoveMemberCommand',
        children: [
          { name: 'repository PracticeRepository.findById' },
          { name: 'repository PracticeRepository.save' },
          {
            name: 'unit-of-work before-commit',
            children: [
              {
                name: 'domain-event identity.practice.member-removed',
                children: [
                  {
                    name: 'handler PracticeMemberRemovedEventHandler',
                    children: [
                      { name: 'repository DelegationRepository.findActiveOfMember' },
                      { name: 'repository IdentityRelationships.forgetMembership' },
                      { name: 'repository DelegationRepository.save' },
                    ],
                  },
                  {
                    name: 'handler PracticeMemberRemovedPublisher',
                    children: [{ name: 'outbox append identity.practice.member-removed' }],
                  },
                ],
              },
            ],
          },
          {
            name: 'unit-of-work before-commit',
            children: [
              {
                name: 'domain-event identity.delegation.revoked',
                children: [
                  {
                    name: 'handler DelegationRevokedEventHandler',
                    children: [{ name: 'repository IdentityRelationships.forgetDelegation' }],
                  },
                  {
                    name: 'handler DelegationRevokedPublisher',
                    children: [{ name: 'outbox append identity.delegation.revoked' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
