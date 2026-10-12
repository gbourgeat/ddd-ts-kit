import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem } from '@ddd-ts-kit/testing/e2e';
import { unwrap } from 'scheduling-api-client';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import { personRegisteredV1, type PersonRegisteredV1Payload } from '@/contexts/identity/published-language/index';
import { expectAnswer } from '$test/e2e/support/expect-answer';
import { expectRefusal } from '$test/e2e/support/expect-refusal';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';
import { storyOf } from '$test/e2e/support/story-of';

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
    expectRefusal(await application.api.registerPerson({ body: adaLovelace }), 401, 'UNAUTHORIZED');
  });

  it('is one trace: the request, the use case, what it saves and what follows the fact', async () => {
    const ada = await application.apiAs({ id: 'ada' });

    const trace = await tracing.traceOf(async () => {
      await unwrap(ada.registerPerson({ body: adaLovelace }));
    });

    expectSpanTree(storyOf(trace), storyOfTheRequest);
  });

  it('answers 200 to PUT /people/me for any signed-in person, with their own identifier', async () => {
    const ada = await application.apiAs({ id: 'ada' });

    const registered = expectAnswer(await ada.registerPerson({ body: adaLovelace }), 200);

    expect(registered.id).toBe('ada');
  });

  it('publishes that the person is registered once, even when they register again with another name', async () => {
    const events = collectEvents(application.events, [personRegisteredV1]);
    const ada = await application.apiAs({ id: 'ada' });

    await unwrap(ada.registerPerson({ body: adaLovelace }));

    await events.waitFor<PersonRegisteredV1Payload>(
      personRegisteredV1,
      (event) => event.payload.personId === 'ada' && event.payload.displayName === 'Ada Lovelace',
    );

    await unwrap(ada.registerPerson({ body: { displayName: 'Ada King', email: 'ada.king@example.com' } }));
    const grace = await application.apiAs({ id: 'grace' });

    await unwrap(grace.registerPerson({ body: { displayName: 'Grace Hopper', email: 'grace@example.com' } }));
    await events.waitFor<PersonRegisteredV1Payload>(personRegisteredV1, (event) => event.payload.personId === 'grace');

    expect(
      events
        .received<PersonRegisteredV1Payload>(personRegisteredV1)
        .filter((event) => event.payload.personId === 'ada'),
    ).toHaveLength(1);

    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    const ada = await application.apiAs({ id: 'ada' });

    expectRefusal(
      await ada.registerPerson({ body: { displayName: '   ', email: 'ada@example.com' } }),
      422,
      'INVALID_DISPLAY_NAME',
    );
  });

  it('refuses a body its contract does not describe, which only the raw HTTP client can send', async () => {
    const ada = await application.as({ id: 'ada' });

    expectProblem(await ada.put('/people/me', { displayName: 'Ada Lovelace' }), {
      status: 422,
      code: 'VALIDATION_FAILED',
    });
  });
});

const adaLovelace = { displayName: 'Ada Lovelace', email: 'ada@example.com' };

const storyOfTheRequest: Parameters<typeof expectSpanTree>[1] = [
  {
    name: 'PUT /people/me',
    kind: 'SERVER',
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
                    children: [{ name: 'repository IdentityRelationships.recordPerson' }],
                  },
                  {
                    name: 'handler PersonRegisteredPublisher',
                    children: [{ name: 'outbox append identity.person.registered' }],
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
