import { beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  isExpired,
  isImpersonated,
  stampCreation,
  tenantScopeOf,
  type Actor,
} from '@ddd-ts-kit/kernel';
import { aSession, anExecutionContext, createTestBuses, defineBuilder, resetSequences, scoped } from '../src';

/* What a project declares once in its platform: the extensions its sessions and its work carry. */
declare module '@ddd-ts-kit/kernel' {
  interface SessionExtensions {
    readonly plan: 'free' | 'team';
  }
  interface ExecutionContextExtensions {
    readonly region: string;
  }
}

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['accountant'], attributes: {} };

const anAccountant = defineBuilder<Actor>({
  defaults: { id: 'grace', type: 'user', roles: ['accountant'], attributes: {} },
});

beforeEach(() => {
  resetSequences();
});

describe('aSession', () => {
  it('builds a valid session of a user of its own by default', () => {
    expect(aSession().build()).toEqual({
      id: 'session-1',
      actor: { id: 'user-1', type: 'user', roles: [], attributes: {} },
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      authenticationMethod: 'password',
      extensions: {},
    });

    expect(aSession().build().id).toBe('session-2');
  });

  it('states what matters to the test, in the words of a session', () => {
    const tonight = new Date('2026-01-01T20:00:00.000Z');

    const session = aSession()
      .of(ada)
      .identifiedBy('session-9')
      .authenticatedBy('sso')
      .withSecondFactor('aal2')
      .impersonatedBy('support-7')
      .expiringAt(tonight)
      .inLocale('fr-FR')
      .inTimeZone('Europe/Paris')
      .build();

    expect(session).toEqual({
      id: 'session-9',
      actor: ada,
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: tonight,
      authenticationMethod: 'sso',
      authenticationStrength: { mfa: true, assuranceLevel: 'aal2' },
      impersonatedBy: 'support-7',
      locale: 'fr-FR',
      timeZone: 'Europe/Paris',
      extensions: {},
    });

    expect(isImpersonated(session)).toBe(true);
    expect(isExpired(session, new Date('2026-01-01T19:59:59.000Z'))).toBe(false);
  });

  it('takes the actor from another builder', () => {
    expect(aSession().of(anAccountant()).build().actor.id).toBe('grace');
  });

  it('dates the session, asks a second factor at no stated level, and carries the extensions of the project', () => {
    const morning = new Date('2026-01-01T08:00:00.000Z');

    const session = aSession().issuedAt(morning).withSecondFactor().withExtensions({ plan: 'team' }).build();

    expect(session).toMatchObject({
      issuedAt: morning,
      authenticationStrength: { mfa: true },
      extensions: { plan: 'team' },
    });

    expect(session.authenticationStrength).not.toHaveProperty('assuranceLevel');
  });

  it('is immutable, so one instance serves every test', () => {
    const base = aSession().of(ada);

    base.impersonatedBy('support-7');

    expect(base.build()).not.toHaveProperty('impersonatedBy');
  });
});

describe('anExecutionContext', () => {
  it('builds the work of a user of its own, of origin test, by default', () => {
    expect(anExecutionContext().build()).toEqual({
      correlationId: 'correlation-1',
      actor: { id: 'user-1', type: 'user', roles: [], attributes: {} },
      origin: 'test',
      extensions: {},
    });
  });

  it('takes the tenant of its actor, unless told another', () => {
    expect(anExecutionContext().as(ada).build().tenantId).toBe('acme');
    expect(anExecutionContext().as(ada).ofTenant('globex').build().tenantId).toBe('globex');
  });

  it('acts as the actor of the session it is in', () => {
    const session = aSession().of(ada).impersonatedBy('support-7');

    const context = anExecutionContext().inSession(session).build();

    expect(context).toMatchObject({ actor: ada, tenantId: 'acme', session: { impersonatedBy: 'support-7' } });
  });

  it('leaves the session behind when the work is seen as another actor', () => {
    const context = anExecutionContext().inSession(aSession().of(ada)).as(anAccountant()).build();

    expect(context.actor.id).toBe('grace');
    expect(context).not.toHaveProperty('session');
  });

  it('states the rest in the words of an execution context', () => {
    const deadline = new Date('2026-01-01T00:00:05.000Z');

    const context = anExecutionContext()
      .correlatedBy('corr-1')
      .causedBy('evt-1')
      .from('event')
      .dueBy(deadline)
      .inLocale('fr-FR')
      .build();

    expect(context).toMatchObject({
      correlationId: 'corr-1',
      causationId: 'evt-1',
      origin: 'event',
      deadline,
      locale: 'fr-FR',
    });
  });

  it('carries the extensions of the project', () => {
    expect(anExecutionContext().withExtensions({ region: 'eu-west' }).build().extensions).toEqual({
      region: 'eu-west',
    });
  });
});

describe('scoped', () => {
  it('runs a block in a context given as a builder, then leaves it', async () => {
    const scope = new AsyncLocalStorageExecutionScope();

    const tenant = await scoped(scope, anExecutionContext().as(ada), async () => tenantScopeOf(scope));

    expect(tenant).toEqual({ tenantId: 'acme' });
    expect(scope.current()).toBeUndefined();
  });

  it('runs a block in a context given as a value', () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const context = anExecutionContext().correlatedBy('corr-1').build();

    expect(scoped(scope, context, () => scope.require())).toBe(context);
  });
});

describe('createTestBuses', () => {
  it('exposes an execution scope infrastructure can stamp and scope with', () => {
    const { executionScope, actorContext, clock } = createTestBuses();

    expect(executionScope.require()).toMatchObject({ correlationId: 'test-correlation', origin: 'test' });
    expect(actorContext.require().id).toBe('test-user');

    expect(stampCreation(executionScope, clock)).toEqual({
      createdAt: clock.now(),
      createdBy: 'test-user',
      updatedAt: clock.now(),
      updatedBy: 'test-user',
    });
  });

  it('starts in the execution context it is given, and follows a block run in another one', () => {
    const { executionScope, actorContext } = createTestBuses({
      executionContext: anExecutionContext().as(ada).build(),
    });

    expect(tenantScopeOf(executionScope)).toEqual({ tenantId: 'acme' });

    expect(scoped(executionScope, anExecutionContext().as(anAccountant()), () => actorContext.require().id)).toBe(
      'grace',
    );

    expect(actorContext.require()).toBe(ada);
  });

  it('keeps the actor context and the scope together', () => {
    const { executionScope, actorContext } = createTestBuses();

    actorContext.actAs(ada);

    expect(executionScope.require().actor).toBe(ada);
  });
});
