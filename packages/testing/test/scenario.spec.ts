import { AssertionError } from 'node:assert';
import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { given, resetSequences, scenario } from '../src/index.js';
import { aLine, anOrder } from './support/builders.js';
import { EmptyOrder, Order, OrderAlreadyPaid, OrderPaid, at } from './support/order.js';

beforeEach(() => {
  resetSequences();
});

/** The message of the AssertionError a failing scenario throws. */
const failureOf = (assertion: () => unknown): string => {
  try {
    assertion();
  } catch (error) {
    expect(error).toBeInstanceOf(AssertionError);

    return error instanceof Error ? error.message : '';
  }

  throw new Error('The scenario was expected to fail');
};

describe('given / when / then', () => {
  it('asserts only the events of when, not those of the arrangement', () => {
    const order = anOrder().build();

    given(order)
      .when((o) => o.pay(at))
      .thenEventNames(['ordering.order.paid']);
  });

  it('accepts a builder as the given state', () => {
    given(anOrder().withLine(aLine().with('quantity', 2)))
      .when((order) => order.pay(at))
      .thenEvents([{ name: 'ordering.order.paid', amount: 30 }]);
  });

  it('matches events by name, by class or by the properties that matter', () => {
    given(anOrder().identifiedBy('order-7'))
      .when((order) => {
        order.addLine({ sku: 'pen', quantity: 1 }, at);
        order.pay(at);
      })
      .thenEvents(['ordering.order.line-added', OrderPaid])
      .thenEvents([{ aggregateId: 'order-7' }, { aggregateId: 'order-7', occurredAt: at, amount: 20 }]);
  });

  it('asserts the error class and code of a refused intention', () => {
    given(anOrder().paid())
      .when((order) => order.pay(at))
      .thenError(OrderAlreadyPaid)
      .thenError(OrderAlreadyPaid, 'ORDER_ALREADY_PAID')
      .thenError(DomainError, 'ORDER_ALREADY_PAID')
      .thenError('ORDER_ALREADY_PAID');
  });

  it('gives the aggregate to thenState, also after an asserted error', () => {
    given(anOrder())
      .when((order) => order.pay(at))
      .thenState((order) => expect(order.status).toBe('paid'));

    given(anOrder().paid())
      .when((order) => order.addLine({ sku: 'pen', quantity: 1 }, at))
      .thenError(OrderAlreadyPaid)
      .thenState((order) => expect(order.total).toBe(10));
  });

  it('asserts that nothing happened', () => {
    given(anOrder())
      .when((order) => order.total)
      .thenNoEvent();
  });

  it('replays a scenario from a fresh aggregate each time', () => {
    const aPlacedOrder = scenario(() => anOrder().build());

    aPlacedOrder.when((order) => order.pay(at)).thenEventNames(['ordering.order.paid']);
    aPlacedOrder.when((order) => order.pay(at)).thenEventNames(['ordering.order.paid']);
  });
});

describe('asynchronous scenarios', () => {
  const later = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));

  it('awaits an asynchronous when', async () => {
    await given(anOrder())
      .when(async (order) => {
        await later();
        order.pay(at);
      })
      .thenEventNames(['ordering.order.paid'])
      .thenState((order) => expect(order.status).toBe('paid'));
  });

  it('awaits an asynchronous arrangement', async () => {
    const loaded = scenario(async () => {
      await later();

      return anOrder().paid().build();
    });

    await loaded.when((order) => order.pay(at)).thenError(OrderAlreadyPaid, 'ORDER_ALREADY_PAID');
  });

  it('catches the rejection of an asynchronous when', async () => {
    await given(anOrder().paid())
      .when(async (order) => {
        await later();
        order.pay(at);
      })
      .thenError('ORDER_ALREADY_PAID')
      .thenState((order) => expect(order.status).toBe('paid'));
  });

  it('rejects with the AssertionError when an assertion fails', async () => {
    const outcome = given(anOrder())
      .when(async (order) => order.pay(at))
      .thenNoEvent();

    await expect(outcome).rejects.toBeInstanceOf(AssertionError);
  });
});

describe('failure messages', () => {
  const paying = () => given(anOrder().identifiedBy('order-1')).when((order) => order.pay(at));

  it('shows expected and recorded names side by side', () => {
    expect(failureOf(() => paying().thenEventNames(['ordering.order.shipped']))).toBe(
      [
        'The recorded event names are not the expected ones.',
        'Expected:',
        '  1. ordering.order.shipped',
        'Recorded:',
        '  1. ordering.order.paid',
      ].join('\n'),
    );
  });

  it('points at the property that differs', () => {
    const message = failureOf(() =>
      paying().thenEvents([{ name: 'ordering.order.paid', amount: 99, aggregateId: 'order-1' }]),
    );

    expect(message).toBe(
      [
        'The recorded events are not the expected ones.',
        'Expected:',
        "  1. { aggregateId: 'order-1', amount: 99, name: 'ordering.order.paid' }",
        'Recorded:',
        "  1. ordering.order.paid { aggregateId: 'order-1', amount: 10, occurredAt: 2026-03-01T10:00:00.000Z }",
        'Difference:',
        '  1. event 1.amount: expected 99, recorded 10',
      ].join('\n'),
    );
  });

  it('says when the number of events differs', () => {
    const message = failureOf(() => paying().thenEvents(['ordering.order.paid', OrderPaid]));

    expect(message).toContain('  1. expected 2 events, recorded 1 event');
    expect(message).toContain('  2. instance of OrderPaid');
  });

  it('says which name or class was expected', () => {
    const message = failureOf(() =>
      given(anOrder())
        .when((order) => order.addLine({ sku: 'pen', quantity: 1 }, at))
        .thenEvents([OrderPaid]),
    );

    expect(message).toContain('event 1: expected an instance of OrderPaid, recorded ordering.order.line-added');

    expect(failureOf(() => paying().thenEvents(['ordering.order.shipped']))).toContain(
      "event 1: expected name 'ordering.order.shipped', recorded 'ordering.order.paid'",
    );
  });

  it('lists the events when none was expected', () => {
    expect(failureOf(() => paying().thenNoEvent())).toContain(
      'Expected no event.\nRecorded:\n  1. ordering.order.paid',
    );
  });

  it('says that the action succeeded when an error was expected', () => {
    expect(failureOf(() => paying().thenError(OrderAlreadyPaid, 'ORDER_ALREADY_PAID'))).toContain(
      'Expected the action to fail with OrderAlreadyPaid with code ORDER_ALREADY_PAID, but it succeeded.',
    );
  });

  it('says which error was raised instead of the expected one', () => {
    const payingTwice = () => given(anOrder().identifiedBy('order-1').paid()).when((o) => o.pay(at));

    expect(failureOf(() => payingTwice().thenError(EmptyOrder))).toBe(
      'Expected the action to fail with EmptyOrder, but it failed with OrderAlreadyPaid (code ORDER_ALREADY_PAID): Order order-1 is already paid.',
    );

    expect(failureOf(() => payingTwice().thenError('EMPTY_ORDER'))).toContain(
      'Expected the action to fail with code EMPTY_ORDER',
    );
  });

  it('does not let an unexpected error pass for a success', () => {
    const payingTwice = () => given(anOrder().paid()).when((order) => order.pay(at));
    const unexpected = 'but the action failed with OrderAlreadyPaid (code ORDER_ALREADY_PAID)';

    expect(failureOf(() => payingTwice().thenEventNames([]))).toContain(`Expected events, ${unexpected}`);
    expect(failureOf(() => payingTwice().thenNoEvent())).toContain(`Expected no event, ${unexpected}`);

    expect(failureOf(() => payingTwice().thenState(() => undefined))).toContain(
      `Expected a state, ${unexpected}`,
    );
  });

  it('lets the assertion library of the runner fail inside thenState', () => {
    expect(() => paying().thenState((order: Order) => expect(order.status).toBe('placed'))).toThrow(
      /expected 'paid' to be 'placed'/,
    );
  });
});
