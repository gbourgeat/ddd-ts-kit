import { describe, expect, it } from 'vitest';
import {
  InMemoryLogger,
  InMemoryMetrics,
  anonymousSession,
  errorReportOf,
  executionContext,
  systemActor,
  type Actor,
  type ActorAttribute,
  type Session,
} from '@ddd-ts-kit/kernel';

/*
 * What a project writes once, in a declaration file of its platform. This spec imports the
 * kernel by its package name, as a project does: the augmentation targets the published types.
 */
declare module '@ddd-ts-kit/kernel' {
  interface SessionExtensions {
    readonly plan: 'free' | 'team';
  }
  interface ExecutionContextExtensions {
    readonly region: string;
  }
  interface ActorExtensions {
    readonly department: string;
    readonly badge: { readonly color: string };
  }
  interface LogFields {
    orderId?: string;
  }
  interface ErrorReportExtensions {
    readonly deployment: 'blue' | 'green';
  }
  interface MetricLabels {
    region?: 'eu' | 'us';
  }
}

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: { department: 'finance', seniority: 4 } };

describe('SessionExtensions', () => {
  it('types the fields a project adds, optional when read', () => {
    const session: Session = {
      id: 'session-1',
      actor: ada,
      issuedAt: new Date(0),
      authenticationMethod: 'sso',
      extensions: { plan: 'team' },
    };

    const plan: 'free' | 'team' | undefined = session.extensions.plan;
    // @ts-expect-error -- an extension is optional when read: the anonymous session has none
    const certain: 'free' | 'team' = session.extensions.plan;

    expect([plan, certain]).toEqual(['team', 'team']);
    expect(anonymousSession().extensions.plan).toBeUndefined();
  });

  it('refuses a value outside the declared type and a field nobody declared', () => {
    // @ts-expect-error -- 'gold' is not a declared plan
    const wrong: Session['extensions'] = { plan: 'gold' };
    // @ts-expect-error -- 'seats' was never declared
    const unknown: Session['extensions'] = { seats: 3 };

    expect([wrong, unknown]).toHaveLength(2);
  });
});

describe('ExecutionContextExtensions', () => {
  it('types the fields a project adds and keeps the kit helper compiling', () => {
    const plain = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });
    const regional = executionContext({ ...plain, extensions: { region: 'eu-west-3' } });
    const region: string | undefined = regional.extensions.region;

    // @ts-expect-error -- a region is a string
    executionContext({ ...plain, extensions: { region: 3 } });

    expect(region).toBe('eu-west-3');
    expect(plain.extensions.region).toBeUndefined();
  });
});

describe('ActorExtensions', () => {
  it('types known attributes inside the existing bag', () => {
    const department: string | undefined = ada.attributes.department;
    const seniority: ActorAttribute | undefined = ada.attributes.seniority;
    // @ts-expect-error -- a department is a string, not any attribute value
    const wrong: Actor['attributes'] = { department: 42 };

    expect([department, seniority, wrong.department]).toEqual(['finance', 4, 42]);
    expect(systemActor('job').attributes.department).toBeUndefined();
  });

  it('refuses an extension that is not an attribute value', () => {
    // @ts-expect-error -- an object is not an ActorAttribute: the extension reads as never
    const wrong: Actor['attributes'] = { badge: { color: 'red' } };

    expect(wrong).toBeDefined();
  });
});

describe('LogFields and MetricLabels', () => {
  it('type the well-known keys a project adds', () => {
    const logger = new InMemoryLogger();
    const metrics = new InMemoryMetrics();

    logger.info('order shipped', { orderId: 'order-1', anythingElse: 3 });
    // @ts-expect-error -- an order id is a string
    logger.info('order shipped', { orderId: 42 });
    metrics.counter('orders_total').increment({ region: 'eu' });
    // @ts-expect-error -- 'mars' is not a declared region
    metrics.counter('orders_total').increment({ region: 'mars' });

    expect(logger.entries).toHaveLength(2);
    expect(metrics.counterValue('orders_total', { region: 'eu' })).toBe(1);
  });
});

describe('ErrorReportExtensions', () => {
  it('types the fields a project adds to an error report, optional when read', () => {
    const report = errorReportOf(new Error('boom'), {
      origin: 'http',
      operation: 'shipOrder',
      extensions: { deployment: 'blue' },
    });

    // @ts-expect-error -- 'red' is not a declared deployment
    const wrong = errorReportOf(undefined, { origin: 'http', operation: 'x', extensions: { deployment: 'red' } });

    expect([report.extensions?.deployment, wrong.extensions?.deployment]).toEqual(['blue', 'red']);
    expect(errorReportOf(undefined, { origin: 'http', operation: 'x' }).extensions).toBeUndefined();
  });
});
