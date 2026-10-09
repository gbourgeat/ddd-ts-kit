import {
  anonymousActor,
  executionContext,
  isActor,
  isSession,
  type Actor,
  type ExecutionContext,
  type Session,
} from '@ddd-ts-kit/kernel';

export const CORRELATION_HEADER = 'x-correlation-id';

type IncomingHeaders = Readonly<Record<string, string | string[] | undefined>>;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** A header value usable as an identifier in logs and response headers, else `undefined`. */
export function wellFormedIdentifier(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value) ? value : undefined;
}

/** The incoming `x-correlation-id` when it is well formed; otherwise the request starts the chain. */
export function correlationIdOf(headers: IncomingHeaders, requestId: string): string {
  return wellFormedIdentifier(headers[CORRELATION_HEADER]) ?? requestId;
}

export interface RequestExecution {
  readonly correlationId: string;
  readonly headers: IncomingHeaders;
  /** What `resolvePrincipal` answered: a `Session`, an `Actor`, or anything else. */
  readonly principal: unknown;
  readonly deadline: Date | undefined;
}

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
  });
}

function actorOfPrincipal(principal: unknown, session: Session | undefined): Actor {
  if (session !== undefined) return session.actor;
  return isActor(principal) ? principal : anonymousActor();
}

const LANGUAGE_TAG = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;

/** The tag of `Accept-Language` with the highest quality, the first one among equals. */
function preferredLanguage(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined;
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
