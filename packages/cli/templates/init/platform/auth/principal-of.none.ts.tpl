import { resolveSession, type Authenticator } from '@ddd-ts-kit/auth';
import type { Session } from '@ddd-ts-kit/kernel';
import { developmentActorHeader } from './development-actor-header.js';

/** Reads the development header of a request and answers its session, derived from the actor it names. */
export function principalOf(authenticator: Authenticator): (raw: unknown) => Promise<Session> {
  return (raw) => resolveSession(authenticator, developmentActorOf(raw));
}

function developmentActorOf(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null || !('headers' in raw)) {
    return undefined;
  }

  const { headers } = raw;

  const value: unknown =
    typeof headers === 'object' && headers !== null ? Reflect.get(headers, developmentActorHeader) : undefined;

  return typeof value === 'string' ? value : undefined;
}
