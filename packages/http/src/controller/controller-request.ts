import type { Readable } from 'node:stream';
import type { Actor } from '@ddd-ts-kit/kernel';
import type { HandlerInput } from '../route/handler-input';
import type { IncomingFile } from '../route/incoming-file';
import type { RequestContext } from '../route/request-context';
import type { UploadSpec } from '../route/upload-spec';
import type { ControllerSpec } from './controller-spec';

/**
 * What `handle` receives for a given declaration: each part has the type its schema produces,
 * and the actor is the one of the execution context of the request. With `rawBody`, `context.stream`
 * is the body as it arrived.
 */
export type ControllerRequest<Spec extends ControllerSpec = ControllerSpec> = HandlerInput<Spec> & {
  readonly actor: Actor;
} & (Spec extends { readonly upload: UploadSpec } ? { readonly upload: IncomingFile } : unknown) &
  (Spec extends { readonly rawBody: true }
    ? { readonly context: RequestContext & { readonly stream: Readable } }
    : unknown);
