import { isAnonymous, ok } from '@ddd-ts-kit/kernel';
import { customSchema, parseOrThrow } from '@ddd-ts-kit/validation';
import { UnauthorizedError } from '../error/unauthorized-error.js';
import type { FieldDecider } from '../field-access/field-decider.js';
import { FieldJudge } from '../field-access/field-judge.js';
import type { RouteInput } from '../route/route-input.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import { withoutTrailingSlashes } from '../route/without-trailing-slashes.js';
import { isRecord } from '../support/is-record.js';
import { FORM_SCHEMA } from './form-schema.js';
import { FormFormat } from './form-format.js';
import { FormOfRoute } from './form-of-route.js';
import type { FormQuery } from './form-query.js';
import { formQuerySchema } from './form-query-schema.js';
import { jsonFormsOf } from './json-forms-of.js';
import { lookupsOf } from './lookups-of.js';

export interface FormRoutesOptions {
  /** Decides the fields the request schemas reserve: the same as `fieldAccess` of the mount options. Left out, every restricted field is absent. */
  readonly fieldAccess?: FieldDecider;
  /** Where the forms are served. Default: `/forms`. */
  readonly prefix?: string;
}

const FORM_RESPONSE = customSchema((input) => ok(input), FORM_SCHEMA);

/**
 * One route per route that declares a `form`: `GET /forms/<operationId>` answers its form for
 * the caller, in JSON Forms or as a tree of blocks (`?format=blocks`). It is guarded as the
 * route it describes is documented: a form of a route that is not public refuses the
 * anonymous caller. Mounted and documented like any route:
 *
 *     const routes = defineRoutes(appRoutes, formRoutes(appRoutes, { fieldAccess }));
 */
export function formRoutes(routes: readonly Route[], options: FormRoutesOptions = {}): readonly Route[] {
  const lookups = lookupsOf(routes);
  const prefix = withoutTrailingSlashes(options.prefix ?? '/forms');

  return routes
    .filter((route) => route.form !== undefined)
    .map((route) => formRoute(route, FormOfRoute.of(route, lookups), { ...options, prefix }));
}

function formRoute(route: Route, form: FormOfRoute, options: FormRoutesOptions & { readonly prefix: string }): Route {
  const query = formQuerySchema(form.body);

  return {
    method: 'GET',
    path: `${options.prefix}/${route.operationId}`,
    operationId: `${route.operationId}Form`,
    summary: `Form: ${route.summary}`,
    description: `The form of ${route.method} ${route.path}, for the caller: a field they may not see is absent, one they may not set is read-only.`,
    ...(route.tags === undefined ? {} : { tags: route.tags }),
    ...(route.groups === undefined ? {} : { groups: route.groups }),
    request: { query },
    responses: { 200: { description: 'The form, for the caller.', body: FORM_RESPONSE } },
    errors: route.security === false ? [] : ['UNAUTHORIZED'],
    security: route.security,
    async handle(input: RouteInput): Promise<RouteOutput> {
      const { actor } = input.context.execution;

      if (route.security !== false && isAnonymous(actor)) {
        throw new UnauthorizedError('Authentication is required');
      }

      // The pipeline read the query through its schema before the handler: what it hands over is a FormQuery.
      const asked = isFormQuery(input.query) ? input.query : parseOrThrow(query, input.query);

      return { status: 200, body: await answer(form, new FieldJudge(actor, options.fieldAccess), asked) };
    },
  };
}

async function answer(form: FormOfRoute, judge: FieldJudge, { format, values }: FormQuery): Promise<unknown> {
  const description = await form.describe(judge, values);

  return format === FormFormat.blocks ? description : jsonFormsOf(description, form.body, values);
}

function isFormQuery(value: unknown): value is FormQuery {
  return isRecord(value) && typeof value['format'] === 'string' && isRecord(value['values']);
}
