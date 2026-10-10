import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import { practiceMemberAddedV1, type PracticeMemberAddedV1Payload } from '../../src/contexts/identity/published-language/index.js';
import { startApplication, type RunningApplication } from './support/start-application.js';
import { storyOf } from './support/story-of.js';

describe('Add member, end to end', () => {
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
    const response = await application.client.post('/practices/practice-id-1/members', { personId: 'grace', role: 'practitioner' });

    expectStatus(response, 401);
  });

  it('answers 403 to a member who does not manage the practice, and to a manager of another practice', async () => {
    const practiceId = await openPracticeWithMembers(application);

    await application.relate({ object: 'practice:elsewhere', relation: 'manager', subject: 'user:marie' });
    const grace = await application.as({ id: 'grace' });
    const marie = await application.as({ id: 'marie' });

    expectStatus(await grace.post('/practices/' + practiceId + '/members', { personId: 'marie', role: 'assistant' }), 403);
    expectStatus(await marie.post('/practices/' + practiceId + '/members', { personId: 'marie', role: 'assistant' }), 403);
  });

  it('is one trace: the request, the use case, what it saves and what follows the fact', async () => {
    const practiceId = await openPracticeWithMembers(application);

    await register(application, 'marie');
    const ada = await application.as({ id: 'ada' });

    const trace = await tracing.traceOf(async () => {
      expectStatus(await ada.post('/practices/' + practiceId + '/members', { personId: 'marie', role: 'practitioner' }), 201);
    });

    // The relay is still publishing what the arrangement announced: only the trace of the request is told here.
    expectSpanTree(storyOf(trace).filter((span) => span.kind === 'SERVER'), storyOfTheRequest);
  });

  it('answers 201 to POST /practices/:practiceId/members for a manager, and a new manager manages the practice at once', async () => {
    const practiceId = await openPracticeWithMembers(application);

    await register(application, 'marie', 'alan');
    const ada = await application.as({ id: 'ada' });

    const added = expectStatus(await ada.post<{ id: string }>('/practices/' + practiceId + '/members', { personId: 'marie', role: 'manager' }), 201);

    const marie = await application.as({ id: 'marie' });

    expect(added.body.id).toBe('marie');
    expectStatus(await marie.post('/practices/' + practiceId + '/members', { personId: 'alan', role: 'assistant' }), 201);
  });

  it('publishes that the member is added, with their name and the time zone of the practice', async () => {
    const events = collectEvents(application.events, [practiceMemberAddedV1]);

    const practiceId = await openPracticeWithMembers(application);

    const joined = await events.waitFor<PracticeMemberAddedV1Payload>(practiceMemberAddedV1, (event) => event.payload.personId === 'grace');

    expect(joined.payload).toEqual({ practiceId, personId: 'grace', role: 'practitioner', displayName: 'Name of grace', timeZone: 'Europe/Paris' });
    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    const practiceId = await openPracticeWithMembers(application);
    const ada = await application.as({ id: 'ada' });
    const members = '/practices/' + practiceId + '/members';

    expectProblem(await ada.post(members, { personId: 'grace', role: 'assistant' }), { status: 409, code: 'ALREADY_MEMBER' });
    expectProblem(await ada.post(members, { personId: 'nobody', role: 'assistant' }), { status: 404, code: 'PERSON_NOT_REGISTERED' });
    expectProblem(await ada.post(members, { personId: 'grace', role: 'patient' }), { status: 422, code: 'VALIDATION_FAILED' });
  });
});

/** A practice opened by the platform admin and managed by ada, with grace as a practitioner and linus as an assistant; answers its identifier. */
async function openPracticeWithMembers(application: RunningApplication): Promise<string> {
  await register(application, 'ada', 'grace', 'linus');

  const root = await application.as({ id: 'root', roles: ['platform-admin'] });
  const opened = expectStatus(await root.post<{ id: string }>('/practices', { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' }), 201);
  const ada = await application.as({ id: 'ada' });

  expectStatus(await ada.post('/practices/' + opened.body.id + '/members', { personId: 'grace', role: 'practitioner' }), 201);
  expectStatus(await ada.post('/practices/' + opened.body.id + '/members', { personId: 'linus', role: 'assistant' }), 201);

  return opened.body.id;
}

/** Each person registers themselves, as at their first sign-in. */
async function register(application: RunningApplication, ...personIds: readonly string[]): Promise<void> {
  for (const personId of personIds) {
    const person = await application.as({ id: personId });

    expectStatus(await person.put('/people/me', { displayName: 'Name of ' + personId, email: personId + '@example.com' }), 200);
  }
}

const storyOfTheRequest: Parameters<typeof expectSpanTree>[1] = [
  {
    name: 'POST /practices/:practiceId/members', kind: 'SERVER',
    children: [
      {
        name: 'command AddMemberCommand',
        children: [
          { name: 'repository PracticeRepository.findById' },
          { name: 'repository PersonRepository.findById' },
          { name: 'repository PracticeRepository.save' },
          {
            name: 'unit-of-work before-commit',
            children: [
              {
                name: 'domain-event identity.practice.member-added',
                children: [
                  {
                    name: 'handler PracticeMemberAddedEventHandler',
                    children: [
                      { name: 'repository IdentityRelationships.recordMembership' },
                    ],
                  },
                  {
                    name: 'handler PracticeMemberAddedPublisher',
                    children: [
                      { name: 'outbox append identity.practice.member-added' },
                    ],
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
