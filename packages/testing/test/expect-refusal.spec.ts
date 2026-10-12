import { ConceptError, DomainError, err, ok } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { expectProblem } from '../src/e2e.js';
import { expectRefusal, given } from '../src/index.js';
import { anOrder } from './support/builders.js';
import { at } from './support/order.js';

class OrderError extends ConceptError {
  static alreadyPaid(orderId: string, paidAt: Date) {
    return OrderError.refusal('ORDER_ALREADY_PAID', `Order ${orderId} is paid.`, { orderId, paidAt });
  }
}

class EmptyOrder extends DomainError {
  readonly code = 'EMPTY_ORDER';
}

const paidAt = new Date('2026-01-02T00:00:00.000Z');

const refuse = (): never => {
  throw OrderError.alreadyPaid('o-1', paidAt);
};

function failureOf(assert: () => unknown): string {
  try {
    assert();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return 'no failure';
}

describe('expectRefusal', () => {
  it('passes on an action that refuses with the code, and returns the error', () => {
    expect(expectRefusal(refuse, 'ORDER_ALREADY_PAID')).toBeInstanceOf(OrderError);
    expect(expectRefusal(refuse, 'ORDER_ALREADY_PAID', { orderId: 'o-1', paidAt })).toBeInstanceOf(OrderError);
  });

  it('reads a caught error, a Result and an old-form error the same way', () => {
    expectRefusal(OrderError.alreadyPaid('o-1', paidAt), 'ORDER_ALREADY_PAID', { orderId: 'o-1' });
    expectRefusal(err(OrderError.alreadyPaid('o-1', paidAt)), 'ORDER_ALREADY_PAID');
    expectRefusal(() => err(new EmptyOrder('Nothing to pay.')), 'EMPTY_ORDER');
    expectRefusal(new EmptyOrder('Nothing to pay.'), 'EMPTY_ORDER');
  });

  it('awaits an asynchronous action', async () => {
    const error = await expectRefusal(
      () => Promise.reject(OrderError.alreadyPaid('o-1', paidAt)),
      'ORDER_ALREADY_PAID',
    );

    expect(error).toBeInstanceOf(OrderError);

    await expect(expectRefusal(() => Promise.resolve('done'), 'ORDER_ALREADY_PAID')).rejects.toThrow(
      'Expected a refusal with code ORDER_ALREADY_PAID, but nothing was refused.',
    );
  });

  it('fails when nothing was refused', () => {
    const nothing = 'Expected a refusal with code ORDER_ALREADY_PAID, but nothing was refused.';

    expect(failureOf(() => expectRefusal(() => 'done', 'ORDER_ALREADY_PAID'))).toBe(nothing);
    expect(failureOf(() => expectRefusal(ok(1), 'ORDER_ALREADY_PAID'))).toBe(nothing);
    expect(failureOf(() => expectRefusal(() => ok(1), 'ORDER_ALREADY_PAID'))).toBe(nothing);
  });

  it('fails on another code, naming what was refused instead', () => {
    expect(failureOf(() => expectRefusal(refuse, 'EMPTY_ORDER'))).toBe(
      'Expected a refusal with code EMPTY_ORDER, but got OrderError (code ORDER_ALREADY_PAID): Order o-1 is paid..',
    );

    expect(failureOf(() => expectRefusal('boom', 'EMPTY_ORDER'))).toBe(
      "Expected a refusal with code EMPTY_ORDER, but got 'boom'.",
    );
  });

  it('fails on a fact that differs or is missing, one line per fact', () => {
    const failure = failureOf(() => expectRefusal(refuse, 'ORDER_ALREADY_PAID', { orderId: 'o-2', total: 3 }));

    expect(failure).toContain('The refusal ORDER_ALREADY_PAID does not carry the expected facts.');
    expect(failure).toContain("fact orderId: expected 'o-2', got 'o-1'");
    expect(failure).toContain('fact total: expected 3, the refusal carries no such fact');

    expect(failureOf(() => expectRefusal(new EmptyOrder('No.'), 'EMPTY_ORDER', { total: 0 }))).toContain(
      'fact total: expected 0, the refusal carries no such fact',
    );
  });
});

describe('thenError with facts', () => {
  const paid = () => {
    const order = anOrder().build();

    order.pay(at);

    return order;
  };

  it('passes on the code alone, as before', () => {
    given(paid())
      .when((order) => order.pay(at))
      .thenError('ORDER_ALREADY_PAID', {});
  });

  it('fails on a fact the error does not carry', () => {
    const failure = failureOf(() =>
      given(paid())
        .when((order) => order.pay(at))
        .thenError('ORDER_ALREADY_PAID', { orderId: 'o-1' }),
    );

    expect(failure).toContain('The error does not carry the expected facts.');
    expect(failure).toContain("fact orderId: expected 'o-1', the refusal carries no such fact");
  });

  it('awaits an asynchronous action before reading the facts', async () => {
    await given(paid())
      .when(() => Promise.reject(OrderError.alreadyPaid('o-1', paidAt)))
      .thenError('ORDER_ALREADY_PAID', { paidAt });
  });
});

describe('expectProblem with facts', () => {
  const response = {
    status: 409,
    headers: { 'content-type': 'application/problem+json' },
    body: { status: 409, code: 'SLOT_TAKEN', facts: { startsAt: '2026-03-02T09:00:00.000Z', grid: 15 } },
  };

  it('passes on the named facts and ignores the others', () => {
    expectProblem(response, { status: 409, code: 'SLOT_TAKEN', facts: { grid: 15 } });
  });

  it('fails on a fact that differs or that the document does not expose', () => {
    expect(() => expectProblem(response, { status: 409, facts: { grid: 30 } })).toThrow();
    expect(() => expectProblem(response, { status: 409, facts: { patientId: 'p-1' } })).toThrow();
    expect(() => expectProblem({ ...response, body: { status: 409 } }, { status: 409, facts: { grid: 15 } })).toThrow();
  });
});
