import type { Schema } from '@ddd-ts-kit/validation';
import type { ResponsesSpec } from './responses-spec.js';

type StatusOf<Key> = Key extends number ? Key : Key extends `${infer Status extends number}` ? Status : never;

type ResultFor<Status, Spec> = Spec extends { readonly body: Schema<infer T> }
  ? { readonly status: StatusOf<Status>; readonly body: T; readonly headers?: Record<string, string> }
  : { readonly status: StatusOf<Status>; readonly body?: undefined; readonly headers?: Record<string, string> };

/** What a handler returns: one of the declared statuses, with the body its schema describes. */
export type HandlerResult<Responses extends ResponsesSpec = ResponsesSpec> = {
  [Status in keyof Responses]: ResultFor<Status, Responses[Status]>;
}[keyof Responses];
