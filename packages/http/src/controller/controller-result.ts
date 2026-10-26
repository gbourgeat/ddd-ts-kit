import type { Schema } from '@ddd-ts-kit/validation';
import type { ControllerSpec } from './controller-spec';

type Body<Response> = Response extends { readonly body: Schema<infer Value> } ? Value : undefined;

type Headers<Response> = Response extends { readonly headers: infer Declared }
  ? { readonly [Name in keyof Declared]: string }
  : undefined;

/**
 * What `handle` returns for a given declaration: the body its response schema describes, or
 * nothing; and, when the response declares headers, `{ body, headers }` (`{ headers }` with no
 * body), every declared header written.
 */
export type ControllerResult<Spec extends ControllerSpec = ControllerSpec> = [Headers<Spec['response']>] extends [
  undefined,
]
  ? Body<Spec['response']>
  : [Body<Spec['response']>] extends [undefined]
    ? { readonly headers: Headers<Spec['response']> }
    : { readonly body: Body<Spec['response']>; readonly headers: Headers<Spec['response']> };
