import { createServer, type Socket } from 'node:net';
import { errorReportOf, executionContext, NoopErrorReporter, type Actor } from '@ddd-ts-kit/kernel';
import { close, defaultStackParser, isInitialized, makeNodeTransport, NodeClient } from '@sentry/node';
import { afterEach, describe, expect, it } from 'vitest';
import { initSentry, SentryErrorReporter } from '../src/index.js';
import { aTracker, type Tracker } from './support/a-tracker.js';
import { LedgerUnavailable } from './support/ledger-unavailable.js';
import { UniqueViolation } from './support/unique-violation.js';

declare module '@ddd-ts-kit/kernel' {
  interface ErrorReportExtensions {
    readonly deployment: 'blue' | 'green';
  }
}

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: { email: 'ada@example.org' } };
const request = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });

let tracker: Tracker | undefined;

async function tracking(options: Parameters<typeof aTracker>[0] = {}): Promise<Tracker> {
  tracker = await aTracker(options);

  return tracker;
}

afterEach(async () => {
  await tracker?.stop();
  tracker = undefined;
});

/** A client whose capture and flush fail, as an SDK with a bug would. */
class BrokenClient extends NodeClient {
  constructor() {
    super({ integrations: [], stackParser: defaultStackParser, transport: makeNodeTransport });
  }

  override captureException(): string {
    throw new Error('the SDK failed');
  }

  override flush(): PromiseLike<boolean> {
    return Promise.reject(new Error('the SDK failed'));
  }
}

function duplicateEmail(email: string): UniqueViolation {
  return new UniqueViolation(`duplicate key value violates unique constraint: Key (email)=(${email}) already exists`);
}

describe('initSentry without a DSN', () => {
  it('starts nothing and reports nothing, so a project runs with none configured', async () => {
    const reporters = [
      initSentry(),
      initSentry({ dsn: '' }),
      initSentry({ dsn: 'http://key@127.0.0.1:9/1', enabled: false }),
    ];

    for (const errors of reporters) {
      errors.report(new Error('boom'), errorReportOf(undefined, { origin: 'http', operation: 'shipOrder' }));

      await expect(errors.flush(10)).resolves.toBe(true);
      expect(errors).toBeInstanceOf(NoopErrorReporter);
    }

    expect(isInitialized()).toBe(false);
  });
});

describe('SentryErrorReporter', () => {
  it('sends one event per report, tagged with what the report says and nothing about the tenant', async () => {
    const { server, errors } = await tracking({ environment: 'staging', release: 'shop@1.4.0' });
    const failure = duplicateEmail('ada@example.org');

    errors.report(
      failure,
      errorReportOf(failure, { origin: 'http', operation: 'PlaceOrder', context: 'ordering' }, request),
    );

    await expect(errors.flush(2_000)).resolves.toBe(true);
    expect(errors).toBeInstanceOf(SentryErrorReporter);
    expect(server.itemTypes).toEqual(['event']);

    expect(server.events[0]).toMatchObject({
      level: 'error',
      environment: 'staging',
      release: 'shop@1.4.0',
      tags: {
        origin: 'http',
        operation: 'PlaceOrder',
        bounded_context: 'ordering',
        correlation_id: 'corr-1',
        error_code: '23505',
      },
      user: { id: 'ada' },
      exception: { values: [{ type: 'UniqueViolation', mechanism: { handled: true } }] },
    });

    expect(server.events[0]?.tags).not.toHaveProperty('tenant_id');

    expect(server.events[0]?.['sdk']).toMatchObject({
      integrations: ['LinkedErrors', 'ContextLines', 'SpanStreaming'],
    });
  });

  it('knows of the user the actor id alone, and tags the tenant only when the project asks', async () => {
    const { server, errors } = await tracking({ tagTenant: true });

    errors.report(new Error('boom'), errorReportOf(undefined, { origin: 'http', operation: 'PlaceOrder' }, request));
    await errors.flush(2_000);

    expect(server.events[0]?.user).toEqual({ id: 'ada' });
    expect(server.events[0]?.tags).toMatchObject({ tenant_id: 'acme' });
  });

  it('groups by class, code and place, never by message: two rows that collide are one problem', async () => {
    const { server, errors } = await tracking();
    const report = errorReportOf(duplicateEmail('x'), { origin: 'http', operation: 'PlaceOrder' });

    for (const email of ['ada@example.org', 'grace@example.org']) {
      errors.report(duplicateEmail(email), report);
    }

    errors.report(
      new LedgerUnavailable('The ledger of ACME is closed'),
      errorReportOf(new LedgerUnavailable('x'), { origin: 'http', operation: 'CloseLedger' }),
    );

    await errors.flush(2_000);

    const fingerprints = server.events.map((event) => event.fingerprint?.join(' | ')).sort();

    expect(fingerprints).toEqual([
      'LedgerUnavailable | LEDGER_UNAVAILABLE',
      'UniqueViolation | 23505 | duplicateEmail reporting.spec.ts',
      'UniqueViolation | 23505 | duplicateEmail reporting.spec.ts',
    ]);
  });

  it('says how bad it is, and carries what the project added to the report', async () => {
    const { server, errors } = await tracking();
    const source = { origin: 'process', operation: 'uncaughtException' } as const;

    errors.report(
      new Error('crash'),
      errorReportOf(undefined, { ...source, severity: 'fatal', extensions: { deployment: 'blue' } }),
    );

    errors.report(new Error('buried'), errorReportOf(undefined, { ...source, severity: 'warning' }));
    await errors.flush(2_000);

    expect(server.events.map((event) => event.level).sort()).toEqual(['fatal', 'warning']);

    expect(server.events.find((event) => event.level === 'fatal')).toMatchObject({
      contexts: { report: { deployment: 'blue' } },
      exception: { values: [{ mechanism: { handled: false } }] },
    });
  });

  it('reports the cause of an error with it, and a thrown value that is not an error', async () => {
    const { server, errors } = await tracking();
    const report = errorReportOf(undefined, { origin: 'schedule', operation: 'billing.export-ledger' });

    errors.report(new Error('export failed', { cause: duplicateEmail('ada@example.org') }), report);
    errors.report('thrown text', report);
    await errors.flush(2_000);

    const types = server.events.map((event) => event.exception?.values?.map((value) => value.type));

    expect(types).toContainEqual(['UniqueViolation', 'Error']);
    expect(server.events.map((event) => event.fingerprint)).toContainEqual(['string']);
  });

  it('never throws and never waits: a tracker that does not answer costs the caller nothing, and flush says so', async () => {
    const sockets: Socket[] = [];
    const silent = createServer((socket) => sockets.push(socket));

    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));

    const address = silent.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    const errors = initSentry({ dsn: `http://publickey@127.0.0.1:${port}/1` });
    const before = Date.now();

    errors.report(new Error('boom'), errorReportOf(undefined, { origin: 'http', operation: 'shipOrder' }));

    expect(Date.now() - before).toBeLessThan(100);
    await expect(errors.flush(50)).resolves.toBe(false);

    for (const socket of sockets) {
      socket.destroy();
    }

    await close(100);
    await new Promise((resolve) => silent.close(resolve));
  });
});

describe('SentryErrorReporter around a client that fails', () => {
  it('neither throws nor rejects: the report is lost, and flush says so', async () => {
    const errors = new SentryErrorReporter(new BrokenClient());

    expect(() =>
      errors.report(new Error('boom'), errorReportOf(undefined, { origin: 'http', operation: 'shipOrder' })),
    ).not.toThrow();

    await expect(errors.flush(10)).resolves.toBe(false);
  });
});

describe('initSentry with sample rates', () => {
  it('sends every error at a sample rate of 1, whatever the rate of the traces', async () => {
    const { server, errors } = await tracking({ sampleRate: 1, tracesSampleRate: 0 });

    errors.report(new Error('boom'), errorReportOf(undefined, { origin: 'http', operation: 'shipOrder' }));
    await errors.flush(2_000);

    expect(server.events).toHaveLength(1);
  });

  it('sends no error at a sample rate of 0', async () => {
    const { server, errors } = await tracking({ sampleRate: 0 });

    errors.report(new Error('boom'), errorReportOf(undefined, { origin: 'http', operation: 'shipOrder' }));
    await errors.flush(2_000);

    expect(server.events).toEqual([]);
  });
});

describe('an error reported outside any span', () => {
  it('leads to the trace the capture point knew', async () => {
    const { server, errors } = await tracking();
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';

    errors.report(new Error('boom'), {
      ...errorReportOf(undefined, { origin: 'event', operation: 'onPaid' }),
      traceId,
    });

    await errors.flush(2_000);

    expect(server.events[0]?.contexts?.trace?.trace_id).toBe(traceId);
  });
});
