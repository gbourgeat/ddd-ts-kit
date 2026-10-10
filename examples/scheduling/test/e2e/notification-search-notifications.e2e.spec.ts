import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { expectProblem, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application.js';

describe('Search notifications, end to end', () => {
  let application: RunningApplication;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('answers 401 to a caller who presents no credential', async () => {
    const response = await application.client.get('/notifications');

    expectStatus(response, 401);
  });

  it('answers 200 to GET /notifications for any signed-in person, with an empty page while nothing was sent to them', async () => {
    await application.relate({ object: 'person:ada', relation: 'self', subject: 'user:ada' });
    const ada = await application.as({ id: 'ada' });

    const response = await ada.get('/notifications');

    expect(expectStatus(response, 200).body).toEqual({ items: [], total: 0 });
  });

  it('shows nothing to a signed-in caller who is no person of the platform yet', async () => {
    const stranger = await application.as({ id: 'stranger' });

    const response = await stranger.get('/notifications?sort=-sentAt&limit=5');

    expect(expectStatus(response, 200).body).toEqual({ items: [], total: 0 });
  });

  it('answers the documented problem to a sort the list does not offer', async () => {
    const ada = await application.as({ id: 'ada' });

    const response = await ada.get('/notifications?sort=kind');

    expectProblem(response, { status: 422 });
  });
});
