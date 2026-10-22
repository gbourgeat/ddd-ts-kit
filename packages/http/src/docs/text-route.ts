import { ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import { defineRoute } from '../route/define-route';
import type { Route } from '../route/route';

/** A public GET route answering a fixed text: a contract or a page of the documentation. */
export interface TextRoute {
  readonly path: string;
  readonly operationId: string;
  readonly summary: string;
  readonly description: string;
  readonly contentType: string;
  readonly body: string;
}

const text = customSchema<string>((input) => ok(String(input)), { type: 'string' });

export function textRoute(route: TextRoute): Route {
  return defineRoute(
    {
      method: 'GET',
      path: route.path,
      operationId: route.operationId,
      summary: route.summary,
      responses: { 200: { description: route.description, body: text } },
      security: false,
    },
    async () => ({ status: 200, body: route.body, headers: { 'content-type': route.contentType } }),
  );
}
