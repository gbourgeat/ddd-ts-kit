import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { openApiDocumentsRoutes } from '@ddd-ts-kit/http/docs';
import { generateOpenApi, routesByDocument } from '@ddd-ts-kit/http/openapi';
import { securitySchemes } from '{{alias.platform}}/auth/authentication/security-schemes{{alias.ext}}';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { OPENAPI_DOCUMENTS } from '{{alias.platform}}/http/openapi-documents{{alias.ext}}';

/**
 * Adds the contract and its interactive page next to the routes, one per document of a split
 * contract, unless documentation is switched off (API_DOCS, off in production by default). The
 * contract is written with the error mapper and the representations the routes are mounted with.
 */
export function withDocumentation(
  routes: readonly Route[],
  config: AppConfig,
  boundary: Pick<ExecuteOptions, 'errorMapper' | 'representations'>,
): readonly Route[] {
  if (!config.docsEnabled) {
    return routes;
  }

  const documents = routesByDocument(routes, OPENAPI_DOCUMENTS).map(({ name, title, routes: selected }) => ({
    name,
    document: generateOpenApi({
      info: { title: title ?? config.serviceName, version: config.serviceVersion },
      routes: selected,
      securitySchemes,
      ...(boundary.errorMapper === undefined ? {} : { errorMapper: boundary.errorMapper }),
      ...(boundary.representations === undefined ? {} : { representations: boundary.representations }),
    }),
  }));

  return [...routes, ...openApiDocumentsRoutes(documents, { ui: '{{docs.ui}}', title: config.serviceName })];
}
