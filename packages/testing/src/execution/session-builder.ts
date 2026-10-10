import type {
  Actor,
  AuthenticationMethod,
  AuthenticationStrength,
  Session,
  SessionExtensionValues,
} from '@ddd-ts-kit/kernel';
import type { Buildable } from '../builders/buildable.js';
import { Builder } from '../builders/builder.js';
import type { Defaults } from '../builders/defaults.js';
import { sequence } from '../builders/sequence.js';
import { aTestUser } from './a-test-user.js';

/** The instant sessions are dated from by default, the one `createTestBuses` freezes its clock at. */
const TEST_EPOCH = new Date('2026-01-01T00:00:00.000Z');

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
