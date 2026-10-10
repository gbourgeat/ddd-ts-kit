import { ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import type { OpenApiDocument } from '../openapi/open-api-document.js';
import { stringifyOpenApi } from '../openapi/stringify-open-api.js';
import { defineRoute } from '../route/define-route.js';
import type { Route } from '../route/route.js';
import { docsPage } from './docs-page.js';
import type { DocsUi } from './docs-ui.js';

export interface DocsRoutesOptions {
  /** Where the JSON contract is served. Default `/openapi.json`. */
  readonly jsonPath?: string;
  /** Where the interactive page is served. Default `/docs`. */
  readonly uiPath?: string;
  readonly ui?: DocsUi;
  /**
   * Base URL of the UI assets. Defaults to a public CDN, pinned to a major version. Point it
   * at self-hosted files when the page must work offline or under a strict CSP.
   */
  readonly assetsUrl?: string;
  readonly title?: string;
}

interface TextRoute {
  readonly path: string;
  readonly operationId: string;
  readonly summary: string;
  readonly description: string;
  readonly contentType: string;
  readonly body: string;
}

const DEFAULT_ASSETS: Record<DocsUi, string> = {
  swagger: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5',
  scalar: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1',
  redoc: 'https://cdn.jsdelivr.net/npm/redoc@2/bundles',
};

const text = customSchema<string>((input) => ok(String(input)), { type: 'string' });

/**
 * Two routes serving the generated contract and an interactive page for it. Mount them next
 * to the application routes; they are deliberately not part of the contract they display.
 */
export function openApiDocsRoutes(
  document: OpenApiDocument,
  options: DocsRoutesOptions = {},
): readonly Route[] {
  const jsonPath = options.jsonPath ?? '/openapi.json';
  const ui = options.ui ?? 'swagger';

  const html = docsPage({
    ui,
    title: options.title ?? document.info.title,
    specUrl: jsonPath,
    assets: options.assetsUrl ?? DEFAULT_ASSETS[ui],
  });

  return [
    textRoute({
      path: jsonPath,
      operationId: 'getOpenApiDocument',
      summary: 'OpenAPI contract',
      description: 'The OpenAPI 3.1 document.',
      contentType: 'application/json; charset=utf-8',
      body: stringifyOpenApi(document),
    }),
    textRoute({
      path: options.uiPath ?? '/docs',
      operationId: 'getOpenApiUi',
      summary: 'Interactive API documentation',
      description: 'An HTML page.',
      contentType: 'text/html; charset=utf-8',
      body: html,
    }),
  ];
}

function textRoute(route: TextRoute): Route {
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
