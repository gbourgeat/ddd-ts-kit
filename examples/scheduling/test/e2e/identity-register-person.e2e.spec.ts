import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import { personRegisteredV1, type PersonRegisteredV1Payload } from '../../src/contexts/identity/published-language/index.js';
import { startApplication, type RunningApplication } from './support/start-application.js';
import { storyOf } from './support/story-of.js';

describe('Register person, end to end', () => {
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
    const response = await application.client.put('/people/me', { displayName: 'Ada Lovelace', email: 'ada@example.com' });

    expectStatus(response, 401);
  });

  it('is one trace: the request, the use case, what it saves and what follows the fact', async () => {
    const ada = await application.as({ id: 'ada' });

    const trace = await tracing.traceOf(async () => {
      expectStatus(await ada.put('/people/me', { displayName: 'Ada Lovelace', email: 'ada@example.com' }), 200);
    });

    expectSpanTree(storyOf(trace), storyOfTheRequest);
  });

  it('answers 200 to PUT /people/me for any signed-in person, with their own identifier', async () => {
    const ada = await application.as({ id: 'ada' });

    const response = await ada.put<{ id: string }>('/people/me', { displayName: 'Ada Lovelace', email: 'ada@example.com' });

    expectStatus(response, 200);
    expect(response.body.id).toBe('ada');
  });

  it('publishes that the person is registered once, even when they register again with another name', async () => {
    const events = collectEvents(application.events, [personRegisteredV1]);
    const ada = await application.as({ id: 'ada' });

    expectStatus(await ada.put('/people/me', { displayName: 'Ada Lovelace', email: 'ada@example.com' }), 200);
    await events.waitFor<PersonRegisteredV1Payload>(personRegisteredV1, (event) => event.payload.personId === 'ada' && event.payload.displayName === 'Ada Lovelace');

    expectStatus(await ada.put('/people/me', { displayName: 'Ada King', email: 'ada.king@example.com' }), 200);
    const grace = await application.as({ id: 'grace' });

    expectStatus(await grace.put('/people/me', { displayName: 'Grace Hopper', email: 'grace@example.com' }), 200);
    await events.waitFor<PersonRegisteredV1Payload>(personRegisteredV1, (event) => event.payload.personId === 'grace');

    expect(events.received<PersonRegisteredV1Payload>(personRegisteredV1).filter((event) => event.payload.personId === 'ada')).toHaveLength(1);
    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    const ada = await application.as({ id: 'ada' });

    expectProblem(await ada.put('/people/me', { displayName: '   ', email: 'ada@example.com' }), { status: 422, code: 'INVALID_DISPLAY_NAME' });
    expectProblem(await ada.put('/people/me', { displayName: 'Ada Lovelace' }), { status: 422, code: 'VALIDATION_FAILED' });
  });
});

const storyOfTheRequest: Parameters<typeof expectSpanTree>[1] = [
  {
    name: 'PUT /people/me', kind: 'SERVER',
    children: [
      {
        name: 'command RegisterPersonCommand',
        children: [
          { name: 'repository PersonRepository.findById' },
          { name: 'repository PersonRepository.save' },
          {
            name: 'unit-of-work before-commit',
            children: [
              {
                name: 'domain-event identity.person.registered',
                children: [
                  {
                    name: 'handler PersonRegisteredEventHandler',
                    children: [
                      { name: 'repository IdentityRelationships.recordPerson' },
                    ],
                  },
                  {
                    name: 'handler PersonRegisteredPublisher',
                    children: [
                      { name: 'outbox append identity.person.registered' },
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
