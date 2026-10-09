import { ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import { defineRoute, type Route } from './index.js';
import { stringifyOpenApi, type OpenApiDocument } from './openapi.js';

export type DocsUi = 'swagger' | 'scalar' | 'redoc';

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
  const uiPath = options.uiPath ?? '/docs';
  const ui = options.ui ?? 'swagger';
  const json = stringifyOpenApi(document);
  const html = page({
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
      body: json,
    }),
    textRoute({
      path: uiPath,
      operationId: 'getOpenApiUi',
      summary: 'Interactive API documentation',
      description: 'An HTML page.',
      contentType: 'text/html; charset=utf-8',
      body: html,
    }),
  ];
}

interface TextRoute {
  readonly path: string;
  readonly operationId: string;
  readonly summary: string;
  readonly description: string;
  readonly contentType: string;
  readonly body: string;
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

interface DocsPage {
  readonly ui: DocsUi;
  readonly title: string;
  readonly specUrl: string;
  readonly assets: string;
}

function page({ ui, title, specUrl, assets }: DocsPage): string {
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>`;
  const spec = escapeHtml(specUrl);
  const base = escapeHtml(assets);
  switch (ui) {
    case 'swagger':
      return `${head}<link rel="stylesheet" href="${base}/swagger-ui.css"></head><body><div id="ui"></div><script src="${base}/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: '#ui' });</script></body></html>`;
    case 'scalar':
      return `${head}</head><body><script id="api-reference" data-url="${spec}"></script><script src="${base}"></script></body></html>`;
    case 'redoc':
      return `${head}</head><body><redoc spec-url="${spec}"></redoc><script src="${base}/redoc.standalone.js"></script></body></html>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
