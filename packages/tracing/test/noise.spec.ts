import { SpanKind, context, trace, type Attributes } from '@opentelemetry/api';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AttributeAllowList,
  NOISE_PATHS,
  configureTracing,
  isNoisePath,
  resetTracingConfiguration,
  tracedDomainEvents,
  tracedPublisher,
  tracedRoutes,
  withSpan,
  type EndedSpan,
} from '../src';
import { InMemoryDomainEventDispatcher, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { expectSpanTree, installTestTracing, type TestTracing } from '../src/testing';
import { aClinic } from './support/clinic/a-clinic';

let tracing: TestTracing;

afterEach(() => {
  tracing.uninstall();
  resetTracingConfiguration();
});

const ok = async (): Promise<{ status: number; headers: Record<string, string> }> => ({ status: 200, headers: {} });

describe('routes that tell no story', () => {
  it('get no span: probes, metrics and the documentation routes of the kit', async () => {
    tracing = installTestTracing();

    const around = tracedRoutes();

    const trace = await tracing.traceOf(async () => {
      await around({ method: 'GET', path: '/health', operationId: 'health' }, ok);
      await around({ method: 'GET', path: '/ready/database', operationId: 'readiness' }, ok);
      await around({ method: 'GET', path: '/api-docs', operationId: 'getOpenApiUi' }, ok);
      await around({ method: 'GET', path: '/contract.json', operationId: 'getOpenApiDocument' }, ok);

      await around(
        { method: 'GET', path: '/api/contracts/back-office.json', operationId: 'getOpenApiDocument_backOffice' },
        ok,
      );

      await around({ method: 'GET', path: '/api/pages/back-office', operationId: 'getOpenApiUi_backOffice' }, ok);
    });

    expect(trace).toEqual([]);
    expect(NOISE_PATHS.every((path) => isNoisePath(`${path}?probe=1`))).toBe(true);
    expect(isNoisePath('/healthcare/patients')).toBe(false);
    expect(isNoisePath('/openapi/back-office.json')).toBe(true);
  });

  it('are the choice of the application when it gives its own rule', async () => {
    tracing = installTestTracing();

    const around = tracedRoutes({ ignore: (route) => route.operationId === 'ping' });

    const trace = await tracing.traceOf(async () => {
      await around({ method: 'GET', path: '/ping', operationId: 'ping' }, ok);
      await around({ method: 'GET', path: '/health', operationId: 'health' }, ok);
    });

    expectSpanTree(trace, [{ name: 'GET /health', kind: 'SERVER' }]);
  });
});

describe('the span of a request', () => {
  it('is named by the route template, never by the URL, and is the one an instrumentation opened', async () => {
    tracing = installTestTracing();

    const around = tracedRoutes();
    const route = { method: 'GET', path: '/orders/:orderId', operationId: 'getOrder' };

    const traced = await tracing.traceOf(async () => {
      const server = trace
        .getTracer('http')
        .startSpan('GET', { kind: SpanKind.SERVER, attributes: { 'url.path': '/orders/42' } });

      await context.with(trace.setSpan(context.active(), server), () => around(route, ok));
      server.end();
    });

    expectSpanTree(traced, [
      {
        name: 'GET /orders/:orderId',
        kind: 'SERVER',
        attributes: { 'http.route': '/orders/:orderId', 'app.operation': 'getOrder', 'http.response.status_code': 200 },
      },
    ]);
  });

  it('is started here, under the active span, when nothing opened one for the request', async () => {
    tracing = installTestTracing();

    const route = { method: 'GET', path: '/orders/:orderId', operationId: 'getOrder' };
    const traced = await tracing.traceOf(() => withSpan('a batch of calls', () => tracedRoutes()(route, ok)));

    expectSpanTree(traced, [
      { name: 'a batch of calls', children: [{ name: 'GET /orders/:orderId', kind: 'SERVER' }] },
    ]);
  });
});

describe('the attribute allow-list', () => {
  const ended = (attributes: Attributes): EndedSpan => ({
    attributes: { ...attributes },
    events: [{ attributes: { 'exception.type': 'TypeError', 'exception.escaped': true } }],
    status: { code: 0 },
  });

  it('keeps what the kit and the instrumentations left on write, and drops the rest', () => {
    const span = ended({
      'app.context': 'billing',
      'http.route': '/orders/:id',
      'db.query.text': 'select * from orders where id = $1',
      'http.request.header.authorization': 'Bearer secret',
      'db.query.parameter.0': '42',
      'enduser.id': 'jane',
      'client.address': '10.0.0.7',
    });

    new AttributeAllowList().onEnd(span);

    expect(Object.keys(span.attributes)).toEqual(['app.context', 'http.route', 'db.query.text']);
    expect(span.events[0]?.attributes).toEqual({ 'exception.type': 'TypeError' });
  });

  it('is extended or replaced by the application', () => {
    const extended = ended({ 'app.context': 'billing', 'tenant.plan': 'gold' });
    const replaced = ended({ 'app.context': 'billing', 'tenant.plan': 'gold' });

    new AttributeAllowList({ alsoAllowed: ['tenant.'] }).onEnd(extended);
    new AttributeAllowList({ allowed: ['tenant.plan'] }).onEnd(replaced);

    expect(Object.keys(extended.attributes)).toEqual(['app.context', 'tenant.plan']);
    expect(Object.keys(replaced.attributes)).toEqual(['tenant.plan']);
  });
});

describe('the caps of a local root, with the new spans', () => {
  it('count the dispatch of domain events: a bulk save does not become a thousand spans', async () => {
    tracing = installTestTracing();
    configureTracing({ maxSpansPerName: 3 });

    const dispatcher = tracedDomainEvents(new InMemoryDomainEventDispatcher());
    const event = { name: 'shop.cart.opened', aggregateId: 'c1', occurredAt: new Date(0) };

    const traced = await tracing.traceOf(() =>
      withSpan('import', () => dispatcher.dispatch(Array.from({ length: 50 }, () => event))),
    );

    expect(traced[0]?.children).toHaveLength(3);
    expect(traced[0]?.attributes['app.dependency_spans.dropped']).toBe(47);
  });
});

describe('the caps of a local root, with a bulk publication', () => {
  it('stop the spans, not the trace: every event still names it', async () => {
    tracing = installTestTracing();
    configureTracing({ maxSpansPerName: 2 });

    const sent: IntegrationEvent[] = [];
    const publisher = tracedPublisher({ publish: async (events) => void sent.push(...events) });

    const events = Array.from(
      { length: 5 },
      (_unused, index): IntegrationEvent => ({
        id: `evt-${index}`,
        type: 'shop.cart.opened',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: {},
      }),
    );

    const [request] = await tracing.traceOf(() => withSpan('import', () => publisher.publish(events)));

    expect(request?.children).toHaveLength(2);

    expect(sent.map((event) => event.traceparent?.slice(3, 35))).toEqual(
      Array.from({ length: 5 }, () => request?.traceId),
    );

    expect(sent[4]?.traceparent).toContain(request?.spanId);
  });
});

describe('sampling', () => {
  it('is decided where the trace starts and followed everywhere: a dropped action leaves no span, in no context', async () => {
    tracing = installTestTracing({ sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(0) }) });

    const clinic = await aClinic();

    const traced = await tracing.traceOf(async () => {
      await clinic.book('09:00');
      await clinic.relay.tick();
    });

    expect(traced).toEqual([]);
    expect(clinic.store.records()[0]?.event.traceparent).toMatch(/-00$/);
    expect(clinic.audit.entries).toHaveLength(3);
  });
});
