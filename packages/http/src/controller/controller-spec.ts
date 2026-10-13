import type { Schema } from '@ddd-ts-kit/validation';
import type { FormHints } from '../forms/form-hints.js';
import type { HttpMethod } from '../route/http-method.js';
import type { ControllerResponse } from './controller-response.js';
import type { GuardReference } from './guard-reference.js';
import type { RouteGroupClass } from './route-group-class.js';

/** Everything a route says, in the decorator of its controller and nowhere else. */
export interface ControllerSpec {
  /** The group the route belongs to: it gives a prefix, tags, guards and error codes. */
  readonly group?: RouteGroupClass;
  readonly method: HttpMethod;
  /** Literal segments and `:name` parameters, after the prefix of the group; `/` for the prefix itself. */
  readonly path: string;
  /** Left out, the name of the class without `Controller`, in camelCase. */
  readonly operationId?: string;
  readonly summary: string;
  readonly description?: string;
  /** Added to the tags of the group. */
  readonly tags?: readonly string[];
  readonly params?: Schema<unknown>;
  readonly query?: Schema<unknown>;
  readonly headers?: Schema<unknown>;
  readonly body?: Schema<unknown>;
  readonly response: ControllerResponse;
  /** Domain error codes the route may answer, added to those of its group and of its guards. */
  readonly errors?: readonly string[];
  /** Run after the guards of the group. With no group, at least one is required: `[Public]` says the route is open. */
  readonly guards?: readonly GuardReference[];
  readonly deprecated?: boolean;
  /** Media types answered besides `application/json`, chosen by `Accept`: `['application/xml', 'text/csv']`. */
  readonly produces?: readonly string[];
  /** Media types a body is read in besides `application/json`: `['application/xml']`. */
  readonly consumes?: readonly string[];
  /** Describes the body as a form at `GET /forms/<operationId>` (`formRoutes`): `defineForm(...)` of a `.form.ts` file, or `{}`. */
  readonly form?: FormHints;
}
