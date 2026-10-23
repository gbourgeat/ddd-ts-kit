import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withSpan } from '../src';
import { expectSpanTree, installTestTracing, renderSpanTree, type TestTracing } from '../src/testing';

let tracing: TestTracing;

beforeAll(() => {
  tracing = installTestTracing();
});

afterAll(() => tracing.uninstall());

const checkout = (): Promise<void> =>
  withSpan('checkout', async () => {
    await withSpan('reserve stock', async () => undefined, { 'app.sku': 'book' });

    await withSpan('charge card', async () => {
      throw new RangeError('card 4242 declined');
    }).catch(() => undefined);
  });

function failureOf(assert: () => void): string {
  try {
    assert();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return '';
}

describe('traceOf', () => {
  it('answers the spans of the action as plain data, children in the order they started', async () => {
    const trace = await tracing.traceOf(checkout);

    expect(trace).toMatchObject([
      {
        name: 'checkout',
        kind: 'INTERNAL',
        status: 'UNSET',
        children: [
          { name: 'reserve stock', attributes: { 'app.sku': 'book' }, children: [] },
          { name: 'charge card', status: 'ERROR', attributes: { 'error.type': 'RangeError' } },
        ],
      },
    ]);

    expect(JSON.parse(JSON.stringify(trace))).toEqual(trace);
  });

  it('forgets the spans of what ran before', async () => {
    await checkout();

    expect(await tracing.traceOf(() => withSpan('alone', () => undefined))).toHaveLength(1);
  });
});

describe('expectSpanTree', () => {
  it('passes on the exact tree, attributes given or not', async () => {
    const trace = await tracing.traceOf(checkout);

    expectSpanTree(trace, [
      { name: 'checkout', children: [{ name: 'reserve stock' }, { name: 'charge card', status: 'ERROR' }] },
    ]);
  });

  it('refuses a span that is not expected, and one that is missing, naming their parent', async () => {
    const trace = await tracing.traceOf(checkout);

    expect(
      failureOf(() => expectSpanTree(trace, [{ name: 'checkout', children: [{ name: 'reserve stock' }] }])),
    ).toContain('under "checkout": expected the spans [reserve stock], found [reserve stock, charge card]');

    expect(failureOf(() => expectSpanTree(trace, []))).toContain(
      'under the trace: expected the spans [none], found [checkout]',
    );
  });

  it('refuses an error nobody expected, a kind and an attribute that differ', async () => {
    const trace = await tracing.traceOf(checkout);

    const failure = failureOf(() =>
      expectSpanTree(trace, [
        {
          name: 'checkout',
          kind: 'SERVER',
          children: [
            { name: 'reserve stock', attributes: { 'app.sku': 'pen', 'app.absent': undefined } },
            { name: 'charge card' },
          ],
        },
      ]),
    );

    expect(failure).toContain('"checkout": expected the kind SERVER, found INTERNAL');
    expect(failure).toContain('"reserve stock": expected app.sku to be "pen", found "book"');
    expect(failure).toContain('"charge card": expected the status not ERROR, found ERROR');
    expect(failure).not.toContain('app.absent to be');
  });

  it('shows both trees, with the attributes the expectation names', async () => {
    const trace = await tracing.traceOf(checkout);

    const failure = failureOf(() =>
      expectSpanTree(trace, [
        { name: 'checkout', children: [{ name: 'reserve stock', attributes: { 'app.sku': 'pen' } }] },
      ]),
    );

    expect(failure).toContain(['Expected:', 'checkout', '  reserve stock {app.sku="pen"}'].join('\n'));

    expect(failure).toContain(
      [
        'Found:',
        'checkout [INTERNAL]',
        '  reserve stock [INTERNAL] {app.sku="book"}',
        '  charge card [INTERNAL] ERROR',
      ].join('\n'),
    );
  });

  it('renders a tree as indented text', () => {
    expect(
      renderSpanTree([{ name: 'a', kind: 'SERVER', children: [{ name: 'b', attributes: { k: 1 } }] }], ['k']),
    ).toBe('a [SERVER]\n  b {k=1}');
  });
});
