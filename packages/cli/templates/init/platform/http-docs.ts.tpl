import type { Route } from '@ddd-ts-kit/http';
import { openApiDocsRoutes } from '@ddd-ts-kit/http/docs';
import { generateOpenApi } from '@ddd-ts-kit/http/openapi';
import { SECURITY_SCHEMES } from './auth/authenticator.js';
import type { AppConfig } from './config.js';

/** Adds the contract and its interactive page next to the routes, unless documentation is switched off (API_DOCS, off in production by default). */
export function withDocumentation(routes: readonly Route[], config: AppConfig): readonly Route[] {
  if (!config.docsEnabled) {
    return routes;
  }
  const document = generateOpenApi({ info: { title: config.serviceName, version: config.serviceVersion }, routes, securitySchemes: SECURITY_SCHEMES });
  return [...routes, ...openApiDocsRoutes(document, { ui: '{{docs.ui}}' })];
}
