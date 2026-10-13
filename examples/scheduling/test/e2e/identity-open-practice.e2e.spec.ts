import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { unwrap } from 'scheduling-api-client';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import {
  practiceMemberAddedV1,
  type PracticeMemberAddedV1Payload,
  practiceOpenedV1,
  type PracticeOpenedV1Payload,
} from '@/contexts/identity/published-language/index';
import type { Listed } from '$test/e2e/support/listed';
import { expectAnswer } from '$test/e2e/support/expect-answer';
import { expectRefusal } from '$test/e2e/support/expect-refusal';
import { registerPeople } from '$test/e2e/support/register-people';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';
import { storyOf } from '$test/e2e/support/story-of';

/** What the trail says of a refusal at the edge. */
interface RefusalLine {
  readonly action: string;
  readonly reason?: string;
  readonly actorId: string;
}

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
    expectRefusal(await application.api.openPractice({ body: opening }), 401, 'UNAUTHORIZED');
  });

  it('answers 403 to a signed-in person who is not the administrator of the network, and records the refusal in the audit trail', async () => {
    await registerPeople(application, 'ada');

    // The trail is append-only, a reset keeps it: the entry of this refusal is found by the correlation the caller gave.
    const correlationId = randomUUID();
    const ada = (await application.as({ id: 'ada' })).withHeaders({ 'x-correlation-id': correlationId });

    expectStatus(await ada.post('/practices', opening), 403);

    const ops = await application.as({ id: 'ops', roles: ['platform-admin'], tenantId: null });
    const denied = await ops.get<Listed<RefusalLine>>('/audit/entries?outcome=denied&correlationId=' + correlationId);

    expect(
      expectStatus(denied, 200).body.items.map(({ action, reason, actorId }) => ({ action, reason, actorId })),
    ).toEqual([{ action: 'http:openPractice', reason: 'FORBIDDEN', actorId: 'ada' }]);
  });

  it('is one trace: the request, the use case, what it saves and what follows the facts', async () => {
    await registerPeople(application, 'ada');
    const root = application.apiAs({ id: 'root', roles: ['network-admin'] });

    const trace = await tracing.traceOf(async () => {
      await unwrap(root.openPractice({ body: opening }));
    });

    // The relay is still publishing what the arrangement announced: only the trace of the request is told here.
    expectSpanTree(
      storyOf(trace).filter((span) => span.kind === 'SERVER'),
      storyOfTheRequest,
    );
  });

  it('answers 201 to POST /practices for the administrator of the network, and the first manager manages the practice at once', async () => {
    await registerPeople(application, 'ada', 'grace');
    const root = application.apiAs({ id: 'root', roles: ['network-admin'] });

    const opened = expectAnswer(await root.openPractice({ body: opening }), 201);
    const ada = application.apiAs({ id: 'ada' });

    expectAnswer(
      await ada.addMember({ path: { practiceId: opened.id }, body: { personId: 'grace', role: 'practitioner' } }),
      201,
    );
  });

  it('publishes that the practice is opened and that its first manager is a member', async () => {
    const events = collectEvents(application.events, [practiceOpenedV1, practiceMemberAddedV1]);

    await registerPeople(application, 'ada');
    const root = application.apiAs({ id: 'root', roles: ['network-admin'] });

    const opened = await unwrap(root.openPractice({ body: opening }));

    const announced = await events.waitFor<PracticeOpenedV1Payload>(
      practiceOpenedV1,
      (event) => event.payload.practiceId === opened.id,
    );

    const joined = await events.waitFor<PracticeMemberAddedV1Payload>(
      practiceMemberAddedV1,
      (event) => event.payload.practiceId === opened.id,
    );

    expect(announced.payload).toMatchObject({ name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' });

    expect(joined.payload).toMatchObject({
      personId: 'ada',
      role: 'manager',
      displayName: 'Name of ada',
      timeZone: 'Europe/Paris',
    });

    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    await registerPeople(application, 'ada');
    const root = application.apiAs({ id: 'root', roles: ['network-admin'] });

    expectRefusal(
      await root.openPractice({ body: { ...opening, timeZone: 'Europe/Atlantis' } }),
      422,
      'UNKNOWN_TIME_ZONE',
    );

    expectRefusal(await root.openPractice({ body: { ...opening, managerId: 'nobody' } }), 404, 'PERSON_NOT_REGISTERED');
  });

  it('refuses a body its contract does not describe, which only the raw HTTP client can send', async () => {
    const root = await application.as({ id: 'root', roles: ['network-admin'] });

    expectProblem(await root.post('/practices', { name: 'Riverside' }), { status: 422, code: 'VALIDATION_FAILED' });
  });
});

const opening = { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' };

const storyOfTheRequest: Parameters<typeof expectSpanTree>[1] = [
  {
    name: 'POST /practices',
    kind: 'SERVER',
    children: [
      {
        name: 'command OpenPracticeCommand',
        children: [
          { name: 'repository PersonRepository.findById' },
          { name: 'repository PracticeRepository.save' },
          {
            name: 'unit-of-work before-commit',
            children: [
              {
                name: 'domain-event identity.practice.opened',
                children: [
                  {
                    name: 'handler PracticeOpenedPublisher',
                    children: [{ name: 'outbox append identity.practice.opened' }],
                  },
                ],
              },
              {
                name: 'domain-event identity.practice.member-added',
                children: [
                  {
                    name: 'handler PracticeMemberAddedEventHandler',
                    children: [{ name: 'repository IdentityRelationships.recordMembership' }],
                  },
                  {
                    name: 'handler PracticeMemberAddedPublisher',
                    children: [{ name: 'outbox append identity.practice.member-added' }],
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
