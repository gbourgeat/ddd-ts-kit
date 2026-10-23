import type { OpenApiDocument } from '../openapi/open-api-document';
import { stringifyOpenApi } from '../openapi/stringify-open-api';
import type { Route } from '../route/route';
import { DEFAULT_ASSETS } from './default-assets';
import { docsPage } from './docs-page';
import { documentsPage, type ListedDocument } from './documents-page';
import type { DocsUi } from './docs-ui';
import { openApiDocsRoutes } from './open-api-docs-routes';
import { textRoute } from './text-route';

/** One document of the contract and the name it is served under. */
export interface NamedOpenApiDocument {
  readonly name: string;
  readonly document: OpenApiDocument;
}

export interface DocumentsRoutesOptions {
  /** Where the JSON of each document is served, `<contractsPath>/<name>.json`. Default `/openapi`. */
  readonly contractsPath?: string;
  /** Where the page is served, and the page of each document under it. Default `/docs`. */
  readonly uiPath?: string;
  readonly ui?: DocsUi;
  readonly assetsUrl?: string;
  readonly title?: string;
}

/**
 * The routes of a contract split into documents: the JSON of each, a page per document and a
 * page that offers them all (Swagger UI selects between them; the other pages link to each). One
 * document is served as `openApiDocsRoutes` serves it, at `/openapi.json` and `/docs`.
 */
export function openApiDocumentsRoutes(
  documents: readonly NamedOpenApiDocument[],
  options: DocumentsRoutesOptions = {},
): readonly Route[] {
  const [only] = documents;
  const { contractsPath = '/openapi', uiPath = '/docs', ui = 'swagger', ...shown } = options;

  if (documents.length === 1 && only !== undefined) {
    return openApiDocsRoutes(only.document, { ...shown, ui, uiPath });
  }

  const assets = shown.assetsUrl ?? DEFAULT_ASSETS[ui];
  const listed = documents.map(({ name, document }) => listedDocument(name, document, { contractsPath, uiPath }));
  const title = shown.title ?? 'API documentation';

  return [
    ...documents.flatMap(({ document }, index) => documentRoutes(document, listed[index], { ui, assets })),
    page(uiPath, 'getOpenApiUi', documentsPage({ ui, title, documents: listed, assets })),
  ];
}

interface Paths {
  readonly contractsPath: string;
  readonly uiPath: string;
}

function listedDocument(name: string, document: OpenApiDocument, { contractsPath, uiPath }: Paths): ListedDocument {
  return { name, title: document.info.title, url: `${contractsPath}/${name}.json`, page: `${uiPath}/${name}` };
}

function documentRoutes(
  document: OpenApiDocument,
  listed: ListedDocument | undefined,
  { ui, assets }: { readonly ui: DocsUi; readonly assets: string },
): Route[] {
  if (listed === undefined) {
    return [];
  }

  const html = docsPage({ ui, title: listed.title, specUrl: listed.url, assets });
  const id = listed.name.replace(/-(\w)/g, (_dash, letter: string) => letter.toUpperCase());

  return [
    textRoute({
      path: listed.url,
      operationId: `getOpenApiDocument_${id}`,
      summary: `OpenAPI contract: ${listed.name}`,
      description: 'An OpenAPI 3.1 document.',
      contentType: 'application/json; charset=utf-8',
      body: stringifyOpenApi(document),
    }),
    page(listed.page, `getOpenApiUi_${id}`, html),
  ];
}

function page(path: string, operationId: string, body: string): Route {
  return textRoute({
    path,
    operationId,
    summary: 'Interactive API documentation',
    description: 'An HTML page.',
    contentType: 'text/html; charset=utf-8',
    body,
  });
}
