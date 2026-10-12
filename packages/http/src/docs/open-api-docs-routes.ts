import type { OpenApiDocument } from '../openapi/open-api-document.js';
import { stringifyOpenApi } from '../openapi/stringify-open-api.js';
import type { Route } from '../route/route.js';
import { DEFAULT_ASSETS } from './default-assets.js';
import { docsPage } from './docs-page.js';
import type { DocsUi } from './docs-ui.js';
import { textRoute } from './text-route.js';

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

/**
 * Two routes serving the generated contract and an interactive page for it. Mount them next
 * to the application routes; they are deliberately not part of the contract they display.
 */
export function openApiDocsRoutes(document: OpenApiDocument, options: DocsRoutesOptions = {}): readonly Route[] {
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
