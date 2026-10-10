import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  NoCurrentTenantError,
  NoExecutionContextError,
  ScopedActorContext,
  SequentialIdGenerator,
  executionContext,
  isPastDeadline,
  logFieldsOf,
  stampCreation,
  stampUpdate,
  tenantScopeOf,
  withActor,
  type Actor,
  type ExecutionContext,
  type ExecutionScope,
  type Session,
} from '../src/index.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const bob: Actor = { id: 'bob', type: 'user', roles: [], attributes: {} };

const adaSession: Session = {
  id: 'session-1',
  actor: ada,
  issuedAt: new Date('2026-03-01T09:00:00.000Z'),
  authenticationMethod: 'sso',
  impersonatedBy: 'support-7',
  extensions: {},
};

const request = executionContext({ correlationId: 'corr-1', actor: ada, session: adaSession, origin: 'http' });
const job = executionContext({ correlationId: 'corr-2', actor: bob, origin: 'schedule' });

describe('ExecutionContext', () => {
  it('takes the tenant of the actor unless one is named', () => {
    expect(request.tenantId).toBe('acme');
    expect(job.tenantId).toBeUndefined();

    expect(executionContext({ correlationId: 'c', actor: ada, tenantId: 'globex', origin: 'cli' }).tenantId).toBe(
      'globex',
    );

    expect(request.extensions).toEqual({});
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('seen as another actor keeps the correlation and drops the session', () => {
    const asBob = withActor(request, bob);

    expect(asBob).toMatchObject({ correlationId: 'corr-1', actor: bob, tenantId: 'acme', origin: 'http' });
    expect(asBob.session).toBeUndefined();
    expect(withActor(request, ada)).toBe(request);
  });

  it('knows when its deadline has passed', () => {
    const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));
    const hurried = executionContext({ ...job, deadline: new Date('2026-03-01T10:00:05.000Z') });

    expect(isPastDeadline(hurried, clock.now())).toBe(false);
    clock.advance(5000);
    expect(isPastDeadline(hurried, clock.now())).toBe(true);
    expect(isPastDeadline(job, clock.now())).toBe(false);
  });

  it('gives a log line its identifiers, impersonation included', () => {
    expect(logFieldsOf(request)).toEqual({
      correlationId: 'corr-1',
      origin: 'http',
      actorId: 'ada',
      tenantId: 'acme',
      impersonatedBy: 'support-7',
    });

    expect(logFieldsOf({ ...job, causationId: 'event-9' })).toEqual({
      correlationId: 'corr-2',
      causationId: 'event-9',
      origin: 'schedule',
      actorId: 'bob',
    });
  });
});

describe.each<[string, () => ExecutionScope]>([
  ['AsyncLocalStorageExecutionScope', () => new AsyncLocalStorageExecutionScope()],
  ['FixedExecutionScope', () => new FixedExecutionScope()],
])('%s', (_name, create) => {
  it('has no context outside of run', () => {
    const scope = create();

    expect(scope.current()).toBeUndefined();
    expect(() => scope.require()).toThrow(NoExecutionContextError);
  });

  it('gives the context to everything run calls, across awaits', async () => {
    const scope = create();

    const seen = await scope.run(request, async () => {
      await Promise.resolve();

      return [scope.current(), scope.require()];
    });

    expect(seen).toEqual([request, request]);
    expect(scope.current()).toBeUndefined();
  });

  it('restores the outer context after a nested run', () => {
    const scope = create();

    const seen = scope.run(request, () => {
      const inner = scope.run(job, () => scope.require().correlationId);

      return [inner, scope.require().correlationId];
    });

    expect(seen).toEqual(['corr-2', 'corr-1']);
  });

  it('forgets the context when the work throws', () => {
    const scope = create();

    expect(() =>
      scope.run(request, () => {
        throw new RangeError('boom');
      }),
    ).toThrow(RangeError);

    expect(scope.current()).toBeUndefined();
  });
});

describe('AsyncLocalStorageExecutionScope', () => {
  it('keeps concurrent units of work apart', async () => {
    const scope = new AsyncLocalStorageExecutionScope();

    const correlationAfter = (context: ExecutionContext, turns: number): Promise<string> =>
      scope.run(context, async () => {
        for (let turn = 0; turn < turns; turn += 1) {
          await Promise.resolve();
        }

        return scope.require().correlationId;
      });

    expect(await Promise.all([correlationAfter(request, 5), correlationAfter(job, 1)])).toEqual(['corr-1', 'corr-2']);
  });
});

describe('ScopedActorContext', () => {
  it('answers the actor of the execution context: the two cannot disagree', () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const actors = new ScopedActorContext(scope, new SequentialIdGenerator('corr'));

    expect(scope.run(request, () => actors.require())).toBe(ada);
    expect(actors.current()).toBeUndefined();
  });

  it('runs work as another actor inside the same unit of work', () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const actors = new ScopedActorContext(scope, new SequentialIdGenerator('corr'));

    const seen = scope.run(request, () => actors.run(bob, () => scope.require()));

    expect(seen).toMatchObject({ correlationId: 'corr-1', actor: bob, origin: 'http' });
    expect(seen.session).toBeUndefined();
  });

  it('opens an internal context when a boundary only knows the actor', () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const actors = new ScopedActorContext(scope, new SequentialIdGenerator('corr'));

    expect(actors.run(ada, () => scope.require())).toEqual(
      executionContext({ correlationId: 'corr-1', actor: ada, origin: 'internal' }),
    );
  });
});

describe('FixedExecutionScope', () => {
  it('answers the context a test gave it', () => {
    const scope = new FixedExecutionScope(request);

    expect(scope.require()).toBe(request);
    scope.enter(job);
    expect(scope.current()).toBe(job);
  });

  it('follows the actor context it is aligned with, both ways', async () => {
    const actors = new FixedActorContext(ada);
    const scope = new FixedExecutionScope(request, actors);

    actors.actAs(bob);
    expect(scope.require().actor).toBe(bob);

    const seen = await scope.run(request, async () => actors.require());

    expect(seen).toBe(ada);
    expect(actors.require()).toBe(bob);

    scope.enter(request);
    expect(actors.require()).toBe(ada);
  });
});

describe('audit stamps and tenant scoping', () => {
  const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

  it('stamp a created record with the current actor and instant', () => {
    expect(stampCreation(new FixedExecutionScope(request), clock)).toEqual({
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      createdBy: 'ada',
      updatedAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedBy: 'ada',
    });
  });

  it('stamp an updated record without touching its creation', () => {
    const created = stampCreation(new FixedExecutionScope(request), clock);
    const later = new FixedClock(new Date('2026-03-02T08:00:00.000Z'));

    expect(stampUpdate(created, new FixedExecutionScope(job), later)).toEqual({
      ...created,
      updatedAt: new Date('2026-03-02T08:00:00.000Z'),
      updatedBy: 'bob',
    });
  });

  it('give the two columns an update statement sets when the stored stamp was not read', () => {
    const later = new FixedClock(new Date('2026-03-02T08:00:00.000Z'));

    expect(stampUpdate(new FixedExecutionScope(job), later)).toEqual({
      updatedAt: new Date('2026-03-02T08:00:00.000Z'),
      updatedBy: 'bob',
    });
  });

  it('refuse to stamp outside of any unit of work', () => {
    expect(() => stampCreation(new FixedExecutionScope(), clock)).toThrow(NoExecutionContextError);
  });

  it('name the tenant every statement is scoped to, or refuse', () => {
    expect(tenantScopeOf(new FixedExecutionScope(request))).toEqual({ tenantId: 'acme' });
    expect(() => tenantScopeOf(new FixedExecutionScope(job))).toThrow(NoCurrentTenantError);
  });
});
