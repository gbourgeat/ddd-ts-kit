import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { collectEvents, expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';
import {
  delegationRevokedV1,
  type DelegationRevokedV1Payload,
} from '#src/contexts/identity/published-language/index.js';
import { startApplication, type RunningApplication } from '#test/e2e/support/start-application.js';
import { storyOf } from '#test/e2e/support/story-of.js';

describe('Revoke delegation, end to end', () => {
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
    const response = await application.client.delete(
      '/practices/practice-id-1/desks/practitioner-id-1/delegations/delegation-id-1',
    );

    expectStatus(response, 401);
  });

  it('answers 403 to the assistant who received the delegation: only the desk or the practice takes it back', async () => {
    const { practiceId, delegationId } = await grantDelegation(application);
    const linus = await application.as({ id: 'linus' });

    const response = await linus.delete('/practices/' + practiceId + '/desks/grace/delegations/' + delegationId);

    expectStatus(response, 403);
  });

  it('is one trace: the request, the use case, what it saves and what follows the fact', async () => {
    const { practiceId, delegationId } = await grantDelegation(application);
    const grace = await application.as({ id: 'grace' });

    const trace = await tracing.traceOf(async () => {
      expectStatus(await grace.delete('/practices/' + practiceId + '/desks/grace/delegations/' + delegationId), 200);
    });

    // The relay is still publishing what the arrangement announced: only the trace of the request is told here.
    expectSpanTree(
      storyOf(trace).filter((span) => span.kind === 'SERVER'),
      storyOfTheRequest,
    );
  });

  it('answers 200 to DELETE /practices/:practiceId/desks/:practitionerId/delegations/:delegationId, and the pair may be granted a delegation again', async () => {
    const { practiceId, delegationId } = await grantDelegation(application);
    const grace = await application.as({ id: 'grace' });

    const revoked = expectStatus(
      await grace.delete<{ id: string }>('/practices/' + practiceId + '/desks/grace/delegations/' + delegationId),
      200,
    );

    expect(revoked.body.id).toBe(delegationId);

    expectStatus(
      await grace.post('/practices/' + practiceId + '/desks/grace/delegations', {
        assistantId: 'linus',
        availabilityIncluded: false,
      }),
      201,
    );
  });

  it('publishes that the delegation is revoked, with its cause', async () => {
    const events = collectEvents(application.events, [delegationRevokedV1]);
    const { practiceId, delegationId } = await grantDelegation(application);
    const ada = await application.as({ id: 'ada' });

    expectStatus(await ada.delete('/practices/' + practiceId + '/desks/grace/delegations/' + delegationId), 200);

    const announced = await events.waitFor<DelegationRevokedV1Payload>(
      delegationRevokedV1,
      (event) => event.payload.delegationId === delegationId,
    );

    expect(announced.payload).toEqual({
      delegationId,
      practiceId,
      practitionerId: 'grace',
      assistantId: 'linus',
      cause: 'revoked',
    });

    events.stop();
  });

  it('answers the documented problem for each business refusal', async () => {
    const { practiceId, delegationId } = await grantDelegation(application);

    await register(application, 'marie');
    const ada = await application.as({ id: 'ada' });

    expectStatus(
      await ada.post('/practices/' + practiceId + '/members', { personId: 'marie', role: 'practitioner' }),
      201,
    );

    const desk = '/practices/' + practiceId + '/desks/grace/delegations/';

    expectProblem(await ada.delete(desk + 'unknown'), { status: 404, code: 'DELEGATION_NOT_FOUND' });

    expectProblem(await ada.delete('/practices/' + practiceId + '/desks/marie/delegations/' + delegationId), {
      status: 404,
      code: 'DELEGATION_NOT_FOUND',
    });

    expectStatus(await ada.delete(desk + delegationId), 200);
    expectProblem(await ada.delete(desk + delegationId), { status: 409, code: 'DELEGATION_NOT_ACTIVE' });
  });
});

/** Grace, practitioner, delegates her desk to linus, assistant of the same practice. */
async function grantDelegation(application: RunningApplication): Promise<{ practiceId: string; delegationId: string }> {
  const practiceId = await openPracticeWithMembers(application);
  const grace = await application.as({ id: 'grace' });

  const granted = expectStatus(
    await grace.post<{ id: string }>('/practices/' + practiceId + '/desks/grace/delegations', {
      assistantId: 'linus',
      availabilityIncluded: true,
    }),
    201,
  );

  return { practiceId, delegationId: granted.body.id };
}

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
    name: 'DELETE /practices/:practiceId/desks/:practitionerId/delegations/:delegationId',
    kind: 'SERVER',
    children: [
      {
        name: 'command RevokeDelegationCommand',
        children: [
          { name: 'repository DelegationRepository.findById' },
          { name: 'repository DelegationRepository.save' },
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
