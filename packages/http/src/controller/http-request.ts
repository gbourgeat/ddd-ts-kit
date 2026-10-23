import type { Actor } from '@ddd-ts-kit/kernel';
import type { RawHeaders } from '../route/raw-headers';
import type { RequestContext } from '../route/request-context';

interface Parts {
  readonly params?: unknown;
  readonly query?: unknown;
  readonly headers?: unknown;
  readonly body?: unknown;
  readonly upload?: unknown;
}

type Part<Given, Name extends keyof Parts, Default> = Given extends { readonly [K in Name]: infer T } ? T : Default;

/**
 * The request as a controller, a mapper or a guard of the project names it: the parts it reads,
 * typed by hand, `HttpRequest<{ params: CancelAppointmentParams; body: CancelAppointmentBody }>`, and
 * `upload: IncomingFile` for a controller that declares an upload.
 * The decorator of the controller checks that its schemas produce those types.
 */
export type HttpRequest<Given extends Parts = Parts> = {
  readonly params: Part<Given, 'params', Record<string, string>>;
  readonly query: Part<Given, 'query', Record<string, unknown>>;
  readonly headers: Part<Given, 'headers', RawHeaders>;
  readonly body: Part<Given, 'body', unknown>;
  readonly actor: Actor;
  readonly context: RequestContext;
} & (Given extends { readonly upload: infer File } ? { readonly upload: File } : unknown);
