import { SpanStatusCode } from '@opentelemetry/api';
import { defineRoute } from '@ddd-ts-kit/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tracedRoutes } from '../src';
import { setupTracing, type TestTracing } from './support/setup-tracing';

const read = defineRoute(
  {
    method: 'GET',
    path: '/appointments/:id',
    operationId: 'getAppointment',
    summary: 'Read',
    responses: { 204: { description: 'Found.' } },
    security: false,
  },
  async () => ({ status: 204 }),
);

describe('tracedRoutes, when the pipeline itself fails', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing();
  });

  afterEach(() => tracing.teardown());

  it('marks the span of the request failed, ends it and lets the failure through, its message kept out', async () => {
    const around = tracedRoutes();

    await expect(
      around(read, () => Promise.reject(new TypeError('db.internal:5432 refused the connection'))),
    ).rejects.toThrow(TypeError);

    const span = tracing.span('GET /appointments/:id');

    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.attributes).toMatchObject({ 'error.type': 'TypeError', 'http.route': '/appointments/:id' });
    expect(JSON.stringify([span.attributes, span.events])).not.toContain('db.internal');
  });
});
