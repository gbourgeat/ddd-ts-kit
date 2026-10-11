import type { Route } from '@ddd-ts-kit/http';
import { openApiDocsRoutes } from '@ddd-ts-kit/http/docs';
import { generateOpenApi } from '@ddd-ts-kit/http/openapi';
import { securitySchemes } from '@/platform/auth/security-schemes';
import type { AppConfig } from '@/platform/config/app-config';

/** Adds the contract and its interactive page next to the routes, unless documentation is switched off (API_DOCS, off in production by default). */
export function withDocumentation(routes: readonly Route[], config: AppConfig): readonly Route[] {
  if (!config.docsEnabled) {
    return routes;
  }

  const document = generateOpenApi({
    info: { title: config.serviceName, version: config.serviceVersion },
    routes,
    securitySchemes,
  });

  return [...routes, ...openApiDocsRoutes(document, { ui: 'swagger' })];
}
