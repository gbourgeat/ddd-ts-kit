import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectProblem } from '@ddd-ts-kit/testing/e2e';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

describe('What the server answers before any route, end to end: a problem, as every refusal', () => {
  let application: RunningApplication;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
  });

  it('answers a path no route serves 404 NOT_FOUND, not the HTML page of Express', async () => {
    expectProblem(await application.client.get('/nowhere'), { status: 404, code: 'NOT_FOUND' });
  });

  it('answers a body that is not JSON 400 MALFORMED_BODY, quoting nothing of it', async () => {
    const response = await fetch(`${application.url}/practices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"jane@example.com",',
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');

    const problem = await response.text();

    expect(JSON.parse(problem)).toMatchObject({ status: 400, code: 'MALFORMED_BODY' });
    expect(problem).not.toContain('jane@example.com');
  });
});
