import {
  anonymousActor,
  executionContext,
  isActor,
  isSession,
  type Actor,
  type ExecutionContext,
  type Session,
} from '@ddd-ts-kit/kernel';
import type { RawHeaders } from '../route/raw-headers.js';

export interface RequestExecution {
  readonly correlationId: string;
  readonly headers: Readonly<RawHeaders>;
  /** What `resolvePrincipal` answered: a `Session`, an `Actor`, or anything else. */
  readonly principal: unknown;
  readonly deadline: Date | undefined;
  /** The tenant the request named, already checked against the caller; the actor's own otherwise. */
  readonly tenantId?: string | undefined;
}

const LANGUAGE_TAG = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;

/**
 * The execution context of one HTTP request. A principal shaped like a `Session` gives the
 * session and its actor, one shaped like an `Actor` gives the actor, anything else is the
 * anonymous actor: the pipeline does not know how the project authenticates.
 */
export function executionOfRequest(request: RequestExecution): ExecutionContext {
  const session = isSession(request.principal) ? request.principal : undefined;
  const locale = session?.locale ?? preferredLanguage(request.headers['accept-language']);

  return executionContext({
    correlationId: request.correlationId,
    actor: actorOfPrincipal(request.principal, session),
    origin: 'http',
    ...(session === undefined ? {} : { session }),
    ...(locale === undefined ? {} : { locale }),
    ...(request.deadline === undefined ? {} : { deadline: request.deadline }),
    ...(request.tenantId === undefined ? {} : { tenantId: request.tenantId }),
  });
}

function actorOfPrincipal(principal: unknown, session: Session | undefined): Actor {
  if (session !== undefined) {
    return session.actor;
  }

  return isActor(principal) ? principal : anonymousActor();
}

/** The tag of `Accept-Language` with the highest quality, the first one among equals. */
function preferredLanguage(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') {
    return undefined;
  }

  const ranked = header
    .split(',')
    .map(weightedTag)
    .filter(({ tag, quality }) => LANGUAGE_TAG.test(tag) && quality > 0)
    .sort((a, b) => b.quality - a.quality);

  return ranked[0]?.tag;
}

function weightedTag(range: string): { tag: string; quality: number } {
  const [tag = '', ...parameters] = range.split(';').map((part) => part.trim());
  const weight = parameters.find((parameter) => parameter.startsWith('q='));
  const quality = weight === undefined ? 1 : Number(weight.slice(2));

  return { tag, quality: Number.isFinite(quality) ? quality : 0 };
}
