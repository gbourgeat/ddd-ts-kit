import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import { practiceMemberAddedV1, type PracticeMemberAddedV1Payload, practiceOpenedV1, type PracticeOpenedV1Payload } from '../../src/contexts/identity/published-language/index.js';
import { startApplication, type RunningApplication } from './support/start-application.js';
import { storyOf } from './support/story-of.js';

describe('Open practice, end to end', () => {
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
    const response = await application.client.post('/practices', opening);

    expectStatus(response, 401);
  });

  it('answers 403 to a signed-in person who is not a platform admin', async () => {
    await register(application, 'ada');
    const ada = await application.as({ id: 'ada' });

    const response = await ada.post('/practices', opening);

    expectStatus(response, 403);
  });

  it('is one trace: the request, the use case, what it saves and what follows the facts', async () => {
    await register(application, 'ada');
    const root = await application.as({ id: 'root', roles: ['platform-admin'] });

    const trace = await tracing.traceOf(async () => {
      expectStatus(await root.post('/practices', opening), 201);
    });

    // The relay is still publishing what the arrangement announced: only the trace of the request is told here.
    expectSpanTree(storyOf(trace).filter((span) => span.kind === 'SERVER'), storyOfTheRequest);
  });

  it('answers 201 to POST /practices for the platform admin, and the first manager manages the practice at once', async () => {
    await register(application, 'ada', 'grace');
    const root = await application.as({ id: 'root', roles: ['platform-admin'] });

    const opened = expectStatus(await root.post<{ id: string }>('/practices', opening), 201);

    const ada = await application.as({ id: 'ada' });

    expectStatus(await ada.post('/practices/' + opened.body.id + '/members', { personId: 'grace', role: 'practitioner' }), 201);
  });

  it('publishes that the practice is opened and that its first manager is a member', async () => {
    const events = collectEvents(application.events, [practiceOpenedV1, practiceMemberAddedV1]);

    await register(application, 'ada');
    const root = await application.as({ id: 'root', roles: ['platform-admin'] });

    const opened = expectStatus(await root.post<{ id: string }>('/practices', opening), 201);

    const announced = await events.waitFor<PracticeOpenedV1Payload>(practiceOpenedV1, (event) => event.payload.practiceId === opened.body.id);
    const joined = await events.waitFor<PracticeMemberAddedV1Payload>(practiceMemberAddedV1, (event) => event.payload.practiceId === opened.body.id);

    expect(announced.payload).toMatchObject({ name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' });
    expect(joined.payload).toMatchObject({ personId: 'ada', role: 'manager', displayName: 'Name of ada', timeZone: 'Europe/Paris' });
    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    await register(application, 'ada');
    const root = await application.as({ id: 'root', roles: ['platform-admin'] });

    expectProblem(await root.post('/practices', { ...opening, timeZone: 'Europe/Atlantis' }), { status: 422, code: 'UNKNOWN_TIME_ZONE' });
    expectProblem(await root.post('/practices', { ...opening, managerId: 'nobody' }), { status: 404, code: 'PERSON_NOT_REGISTERED' });
    expectProblem(await root.post('/practices', { name: 'Riverside' }), { status: 422, code: 'VALIDATION_FAILED' });
  });
});

const opening = { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' };

/** Each person registers themselves, as at their first sign-in. */
async function register(application: RunningApplication, ...personIds: readonly string[]): Promise<void> {
  for (const personId of personIds) {
    const person = await application.as({ id: personId });

    expectStatus(await person.put('/people/me', { displayName: 'Name of ' + personId, email: personId + '@example.com' }), 200);
  }
}

const storyOfTheRequest: Parameters<typeof expectSpanTree>[1] = [
  {
    name: 'POST /practices', kind: 'SERVER',
    children: [
      {
        name: 'command OpenPracticeCommand',
        children: [
          { name: 'repository PersonRepository.findById' },
          {
            name: 'repository PracticeRepository.save',
            children: [
              {
                name: 'domain-event identity.practice.opened',
                children: [
                  {
                    name: 'handler PracticeOpenedPublisher',
                    children: [
                      { name: 'outbox append identity.practice.opened' },
                    ],
                  },
                ],
              },
              {
                name: 'domain-event identity.practice.member-added',
                children: [
                  {
                    name: 'handler PracticeMemberAddedEventHandler',
                    children: [
                      { name: 'external IdentityRelationships.recordMembership' },
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
