import {
  executionContext,
  type Actor,
  type ExecutionContext,
  type ExecutionContextExtensionValues,
  type ExecutionOrigin,
  type Session,
} from '@ddd-ts-kit/kernel';
import type { Buildable } from '../builders/buildable.js';
import { Builder } from '../builders/builder.js';
import type { Defaults } from '../builders/defaults.js';
import { resolve } from '../builders/resolve.js';
import { sequence } from '../builders/sequence.js';
import { aTestUser } from './a-test-user.js';

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
