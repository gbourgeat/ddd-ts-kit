import { SCRUBBED_MESSAGE, errorReportOf } from '@ddd-ts-kit/kernel';
import { addBreadcrumb, getIsolationScope, type ErrorEvent } from '@sentry/node';
import { afterEach, describe, expect, it } from 'vitest';
import { scrubEvent, scrubRequest } from '../src/index.js';
import { aTracker, type Tracker } from './support/a-tracker.js';
import { LedgerUnavailable } from './support/ledger-unavailable.js';
import { UniqueViolation } from './support/unique-violation.js';

const report = errorReportOf(undefined, { origin: 'http', operation: 'PlaceOrder' });
const leaking = (): UniqueViolation => new UniqueViolation('Key (email)=(ada@example.org) already exists');

/** What a project could install without thinking: an integration copying the whole request onto the event. */
const copiesTheRequest = {
  name: 'CopiesTheRequest',
  processEvent(event: ErrorEvent): ErrorEvent {
    event.request = {
      method: 'POST',
      url: 'https://shop.example/orders?coupon=SECRET10#pay',
      query_string: 'coupon=SECRET10',
      data: { card: '4111 1111 1111 1111' },
      cookies: { session: 'abc' },
      env: { REMOTE_ADDR: '203.0.113.7' },
      headers: {
        authorization: 'Bearer token-1',
        cookie: 'session=abc',
        'x-api-key': 'key-1',
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'curl/8',
      },
    };

    return event;
  },
};

let tracker: Tracker | undefined;

async function tracking(options: Parameters<typeof aTracker>[0] = {}): Promise<Tracker> {
  tracker = await aTracker(options);

  return tracker;
}

afterEach(async () => {
  getIsolationScope().setUser(null).clearBreadcrumbs();
  await tracker?.stop();
  tracker = undefined;
});

describe('what leaves the process by default', () => {
  it('is the method and the path of a request: no body, cookie, credential header, address or query string', async () => {
    const { server, errors } = await tracking({ integrations: [copiesTheRequest] });

    errors.report(new Error('boom'), report);
    await errors.flush(2_000);

    expect(server.events[0]?.request).toEqual({
      method: 'POST',
      url: 'https://shop.example/orders',
      headers: { 'user-agent': 'curl/8' },
    });
  });

  it('is the id of the user, whatever the project put next to it', async () => {
    const { server, errors } = await tracking();

    getIsolationScope().setUser({ id: 'ada', email: 'ada@example.org', username: 'Ada', ip_address: '203.0.113.7' });
    errors.report(new Error('boom'), report);
    await errors.flush(2_000);

    expect(server.events[0]?.user).toEqual({ id: 'ada' });
  });

  it('has no breadcrumb the project did not write: the console and the outgoing calls leave none', async () => {
    const { server, errors } = await tracking();

    console.info('order 42 placed by ada@example.org');
    await fetch(server.dsn.replace('publickey@', ''));
    errors.report(new Error('boom'), report);
    await errors.flush(2_000);

    expect(server.events[0]).not.toHaveProperty('breadcrumbs');

    addBreadcrumb({ category: 'shop', message: 'cart checked out' });
    errors.report(new Error('again'), report);
    await errors.flush(2_000);

    expect(server.events.at(-1)?.breadcrumbs).toMatchObject([{ category: 'shop', message: 'cart checked out' }]);
  });

  it('has a stack without the value of any local variable', async () => {
    const { server, errors } = await tracking();
    const cardNumber = '4111 1111 1111 1111';

    errors.report(new Error(`charge refused for card ending ${cardNumber.slice(-4)}`), report);
    await errors.flush(2_000);

    const frames = server.events[0]?.exception?.values?.[0]?.stacktrace?.frames ?? [];

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter((frame) => 'vars' in frame)).toEqual([]);
  });

  it('keeps the message of every error: it is what the tracker is read for', async () => {
    const { server, errors } = await tracking();

    errors.report(leaking(), report);
    await errors.flush(2_000);

    expect(server.events[0]?.exception?.values?.[0]?.value).toBe('Key (email)=(ada@example.org) already exists');
  });
});

describe('with scrubMessages', () => {
  it('removes the message of what is not a domain error, and keeps the one the project wrote', async () => {
    const { server, errors } = await tracking({ scrubMessages: true });

    errors.report(new LedgerUnavailable('The ledger is closed for maintenance', { cause: leaking() }), report);
    await errors.flush(2_000);

    expect(server.events[0]?.exception?.values?.map(({ type, value }) => ({ type, value }))).toEqual([
      { type: 'UniqueViolation', value: SCRUBBED_MESSAGE },
      { type: 'LedgerUnavailable', value: 'The ledger is closed for maintenance' },
    ]);

    expect(JSON.stringify(server.events[0]?.exception?.values?.map(({ type, value }) => [type, value]))).not.toContain(
      'ada@example.org',
    );
  });
});

describe('the beforeSend of the project', () => {
  it('runs last, on the scrubbed event, and may drop it', async () => {
    const seen: ErrorEvent[] = [];

    const { server, errors } = await tracking({
      integrations: [copiesTheRequest],
      beforeSend: (event) => {
        seen.push(event);

        return event.exception?.values?.some((value) => value.type === 'TypeError') === true ? null : event;
      },
    });

    errors.report(new TypeError('x is not a function'), report);
    errors.report(new Error('boom'), report);
    await errors.flush(2_000);

    expect(seen.map((event) => event.request?.url)).toEqual([
      'https://shop.example/orders',
      'https://shop.example/orders',
    ]);

    expect(server.events.map((event) => event.exception?.values?.[0]?.type)).toEqual(['Error']);
  });
});

describe('the scrubbers alone', () => {
  it('scrubRequest keeps what identifies the route and drops the rest', () => {
    expect(
      scrubRequest({
        url: '/orders?id=7',
        data: 'raw',
        headers: { 'Set-Cookie': 'a=b', 'X-CSRF-Token': 't', accept: 'application/json' },
      }),
    ).toEqual({
      url: '/orders',
      headers: { accept: 'application/json' },
    });

    expect(scrubRequest({})).toEqual({});
  });

  it('scrubEvent removes a user without id and the message of an event that is one', () => {
    const event: ErrorEvent = {
      type: undefined,
      user: { email: 'ada@example.org' },
      message: 'ada@example.org failed',
    };

    expect(scrubEvent(event, {}, { scrubMessages: true })).toEqual({
      type: undefined,
      user: {},
      message: SCRUBBED_MESSAGE,
    });
  });

  it('scrubEvent keeps the message of a domain error among those an AggregateError gathers', () => {
    const gathered = new AggregateError([leaking(), new LedgerUnavailable('The ledger is closed')], 'two steps failed');

    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          { type: 'LedgerUnavailable', value: 'The ledger is closed' },
          { type: 'UniqueViolation', value: 'Key (email)=(ada@example.org) already exists' },
          { type: 'AggregateError', value: 'two steps failed' },
        ],
      },
    };

    const values = scrubEvent(event, { originalException: gathered }, { scrubMessages: true }).exception?.values;

    expect(values?.map(({ value }) => value)).toEqual(['The ledger is closed', SCRUBBED_MESSAGE, SCRUBBED_MESSAGE]);
  });
});
