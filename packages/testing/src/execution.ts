import {
  executionContext,
  type Actor,
  type AuthenticationMethod,
  type AuthenticationStrength,
  type ExecutionContext,
  type ExecutionContextExtensionValues,
  type ExecutionOrigin,
  type ExecutionScope,
  type Session,
  type SessionExtensionValues,
} from '@ddd-ts-kit/kernel';
import { Builder, resolve, sequence, type Buildable, type Defaults, type Resolvable } from './builder.js';

/** The instant sessions and contexts are dated from by default, the one `createTestBuses` freezes its clock at. */
const TEST_EPOCH = new Date('2026-01-01T00:00:00.000Z');

/** A user of its own at each build, without tenant, role or attribute: `user-1`, `user-2`... */
const aTestUser = sequence('user', (n): Actor => ({ id: `user-${String(n)}`, type: 'user', roles: [], attributes: {} }));

interface SessionProps {
  id: string;
  actor: Actor;
  issuedAt: Date;
  expiresAt: Date | undefined;
  authenticationMethod: AuthenticationMethod;
  authenticationStrength: AuthenticationStrength | undefined;
  impersonatedBy: string | undefined;
  locale: string | undefined;
  timeZone: string | undefined;
  extensions: SessionExtensionValues;
}

/**
 * By default the session of a user of its own (`user-1`, `user-2`...), opened with a password
 * at the test epoch, never expiring, with an id of its own: `session-1`, `session-2`...
 */
export class SessionBuilder extends Builder<SessionProps, Session> {
  of(actor: Buildable<Actor>): this {
    return this.with('actor', actor);
  }

  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  issuedAt(instant: Date): this {
    return this.with('issuedAt', instant);
  }

  expiringAt(instant: Date): this {
    return this.with('expiresAt', instant);
  }

  authenticatedBy(method: AuthenticationMethod): this {
    return this.with('authenticationMethod', method);
  }

  withSecondFactor(assuranceLevel?: string): this {
    return this.with('authenticationStrength', {
      mfa: true,
      ...(assuranceLevel === undefined ? {} : { assuranceLevel }),
    });
  }

  /** Support staff acting as the actor of the session. */
  impersonatedBy(impersonatorId: string): this {
    return this.with('impersonatedBy', impersonatorId);
  }

  inLocale(locale: string): this {
    return this.with('locale', locale);
  }

  inTimeZone(timeZone: string): this {
    return this.with('timeZone', timeZone);
  }

  withExtensions(extensions: SessionExtensionValues): this {
    return this.with('extensions', extensions);
  }

  protected defaults(): Defaults<SessionProps> {
    return {
      id: sequence('session'),
      actor: aTestUser,
      issuedAt: TEST_EPOCH,
      expiresAt: undefined,
      authenticationMethod: 'password',
      authenticationStrength: undefined,
      impersonatedBy: undefined,
      locale: undefined,
      timeZone: undefined,
      extensions: {},
    };
  }

  protected construct(props: SessionProps): Session {
    const { expiresAt, authenticationStrength, impersonatedBy, locale, timeZone, ...required } = props;
    return {
      ...required,
      ...(expiresAt === undefined ? {} : { expiresAt }),
      ...(authenticationStrength === undefined ? {} : { authenticationStrength }),
      ...(impersonatedBy === undefined ? {} : { impersonatedBy }),
      ...(locale === undefined ? {} : { locale }),
      ...(timeZone === undefined ? {} : { timeZone }),
    };
  }
}

const sessionBuilder = new SessionBuilder();

/** `aSession().of(ada).impersonatedBy('support-7').expiringAt(tonight).build()` */
export function aSession(): SessionBuilder {
  return sessionBuilder;
}

interface ExecutionContextProps {
  correlationId: string;
  causationId: string | undefined;
  actor: Actor | undefined;
  session: Session | undefined;
  tenantId: string | undefined;
  locale: string | undefined;
  deadline: Date | undefined;
  origin: ExecutionOrigin;
  extensions: ExecutionContextExtensionValues;
}

/**
 * By default the work of a user of its own, of origin `test`, with a correlation id of its
 * own: `correlation-1`, `correlation-2`... Built with `executionContext`, so the tenant is
 * that of the actor unless said otherwise.
 */
export class ExecutionContextBuilder extends Builder<ExecutionContextProps, ExecutionContext> {
  correlatedBy(correlationId: string): this {
    return this.with('correlationId', correlationId);
  }

  causedBy(causationId: string): this {
    return this.with('causationId', causationId);
  }

  /** The actor of the work. The session, if one was set, goes: it was another actor's. */
  as(actor: Buildable<Actor>): this {
    return this.withMany({ actor, session: undefined });
  }

  /** The session of the work, and its actor as the actor of the work. */
  inSession(session: Buildable<Session>): this {
    return this.withMany({ session, actor: undefined });
  }

  ofTenant(tenantId: string): this {
    return this.with('tenantId', tenantId);
  }

  from(origin: ExecutionOrigin): this {
    return this.with('origin', origin);
  }

  dueBy(deadline: Date): this {
    return this.with('deadline', deadline);
  }

  inLocale(locale: string): this {
    return this.with('locale', locale);
  }

  withExtensions(extensions: ExecutionContextExtensionValues): this {
    return this.with('extensions', extensions);
  }

  protected defaults(): Defaults<ExecutionContextProps> {
    return {
      correlationId: sequence('correlation'),
      causationId: undefined,
      actor: undefined,
      session: undefined,
      tenantId: undefined,
      locale: undefined,
      deadline: undefined,
      origin: 'test',
      extensions: {},
    };
  }

  protected construct(props: ExecutionContextProps): ExecutionContext {
    const { causationId, actor, session, tenantId, locale, deadline, ...required } = props;
    return executionContext({
      ...required,
      actor: actor ?? session?.actor ?? resolve(aTestUser),
      ...(causationId === undefined ? {} : { causationId }),
      ...(session === undefined ? {} : { session }),
      ...(tenantId === undefined ? {} : { tenantId }),
      ...(locale === undefined ? {} : { locale }),
      ...(deadline === undefined ? {} : { deadline }),
    });
  }
}

const executionContextBuilder = new ExecutionContextBuilder();

/** `anExecutionContext().as(ada).ofTenant('acme').from('http').build()` */
export function anExecutionContext(): ExecutionContextBuilder {
  return executionContextBuilder;
}

/**
 * Runs a block inside an execution context, given as a value or as a builder:
 * `await scoped(scope, anExecutionContext().as(ada), () => repository.save(order))`.
 */
export function scoped<T>(
  scope: ExecutionScope,
  context: ExecutionContext | Resolvable<ExecutionContext>,
  work: () => T,
): T {
  return scope.run(resolve(context), work);
}
