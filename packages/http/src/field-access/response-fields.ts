import type { ResponseSpec } from '../route/response-spec';
import type { Route } from '../route/route';
import { fieldAccess } from './field-access';
import { FieldTree } from './field-tree';

/**
 * The restricted fields of an answer: those of the response declared for its status, and for a
 * status the route does not declare, those of every response it declares, since nothing says
 * which of them the answer is. Nothing is shown by omission.
 */
export function responseFields(route: Route, status: number): FieldTree {
  // A copy has a string index, which is how the statuses are enumerated.
  const every: Readonly<Record<string, ResponseSpec>> = { ...route.responses };
  const declared = every[String(status)];
  const responses = declared === undefined ? Object.values(every) : [declared];

  return FieldTree.of(responses.flatMap(({ body }) => fieldAccess.of(body)));
}
