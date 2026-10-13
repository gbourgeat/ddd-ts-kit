import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import { delegationGrantedV1, type DelegationGrantedV1Payload } from '@/contexts/identity/published-language/index';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';
import { storyOf } from '$test/e2e/support/story-of';

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

describe('Grant delegation, end to end', () => {
  it('is one trace: the request, the use case, what it saves and what follows the fact', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const grace = await application.as({ id: 'grace' });

    const trace = await tracing.traceOf(async () => {
      expectStatus(await grace.post('/practices/' + practiceId + '/desks/grace/delegations', terms), 201);
    });

    // The relay is still publishing what the arrangement announced: only the trace of the request is told here.
    expectSpanTree(
      storyOf(trace).filter((span) => span.kind === 'SERVER'),
      storyOfTheRequest,
    );
  });

  it('answers 201 to POST /practices/:practiceId/desks/:practitionerId/delegations for the practitioner of the desk and for a manager of the practice', async () => {
    const practiceId = await openPracticeWithMembers(application);

    await register(application, 'marie');
    const ada = await application.as({ id: 'ada' });

    expectStatus(
      await ada.post('/practices/' + practiceId + '/members', { personId: 'marie', role: 'assistant' }),
      201,
    );

    const grace = await application.as({ id: 'grace' });

    const byThePractitioner = await grace.post('/practices/' + practiceId + '/desks/grace/delegations', terms);

    const byTheManager = await ada.post('/practices/' + practiceId + '/desks/grace/delegations', {
      ...terms,
      assistantId: 'marie',
    });

    expectStatus(byThePractitioner, 201);
    expectStatus(byTheManager, 201);
  });

  it('publishes that the delegation is granted, with its terms', async () => {
    const events = collectEvents(application.events, [delegationGrantedV1]);
    const practiceId = await openPracticeWithMembers(application);
    const grace = await application.as({ id: 'grace' });
    const endsAt = new Date(Date.now() + 86_400_000).toISOString();

    const granted = expectStatus(
      await grace.post<{ id: string }>('/practices/' + practiceId + '/desks/grace/delegations', {
        ...terms,
        availabilityIncluded: true,
        endsAt,
      }),
      201,
    );

    const announced = await events.waitFor<DelegationGrantedV1Payload>(
      delegationGrantedV1,
      (event) => event.payload.delegationId === granted.body.id,
    );

    expect(announced.payload).toEqual({
      delegationId: granted.body.id,
      practiceId,
      practitionerId: 'grace',
      assistantId: 'linus',
      availabilityIncluded: true,
      endsAt,
    });

    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const grace = await application.as({ id: 'grace' });
    const delegations = '/practices/' + practiceId + '/desks/grace/delegations';

    expectProblem(await grace.post(delegations, { ...terms, assistantId: 'ada' }), {
      status: 422,
      code: 'NOT_AN_ASSISTANT',
    });

    expectProblem(await grace.post(delegations, { ...terms, endsAt: '2000-01-01T00:00:00.000Z' }), {
      status: 422,
      code: 'DELEGATION_ENDS_IN_THE_PAST',
    });

    expectStatus(await grace.post(delegations, terms), 201);
    expectProblem(await grace.post(delegations, terms), { status: 409, code: 'DELEGATION_ALREADY_ACTIVE' });
  });
});

describe('Grant delegation, end to end, kept from who may not grant it', () => {
  it('answers 401 to a caller who presents no credential', async () => {
    const response = await application.client.post(
      '/practices/practice-id-1/desks/practitioner-id-1/delegations',
      terms,
    );

    expectStatus(response, 401);
  });

  it('answers 403 to an assistant of the practice, who neither holds the desk nor manages the practice', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const linus = await application.as({ id: 'linus' });

    const response = await linus.post('/practices/' + practiceId + '/desks/grace/delegations', terms);

    expectStatus(response, 403);
  });

  it('answers 403 on the desk of a member who is not a practitioner: nobody holds a desk that does not exist', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const ada = await application.as({ id: 'ada' });

    const response = await ada.post('/practices/' + practiceId + '/desks/linus/delegations', terms);

    expectStatus(response, 403);
  });
});

const terms = { assistantId: 'linus', availabilityIncluded: false };

/** A practice opened by the administrator of the network and managed by ada, with grace as a practitioner and linus as an assistant; answers its identifier. */
async function openPracticeWithMembers(application: RunningApplication): Promise<string> {
  await register(application, 'ada', 'grace', 'linus');

  const root = await application.as({ id: 'root', roles: ['network-admin'] });

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
    name: 'POST /practices/:practiceId/desks/:practitionerId/delegations',
    kind: 'SERVER',
    children: [
      {
        name: 'command GrantDelegationCommand',
        children: [
          { name: 'repository PracticeRepository.findById' },
          { name: 'repository DelegationRepository.findActiveBetween' },
          { name: 'repository DelegationRepository.save' },
          {
            name: 'unit-of-work before-commit',
            children: [
              {
                name: 'domain-event identity.delegation.granted',
                children: [
                  {
                    name: 'handler DelegationGrantedEventHandler',
                    children: [{ name: 'repository IdentityRelationships.recordDelegation' }],
                  },
                  {
                    name: 'handler DelegationGrantedPublisher',
                    children: [{ name: 'outbox append identity.delegation.granted' }],
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
