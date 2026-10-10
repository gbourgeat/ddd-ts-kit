import { describe, expect, it } from 'vitest';
import { executeRoute, type RawRequest, type Route } from '../src/index.js';
import { generateOpenApi } from '../src/openapi.js';
import { openApiDocsRoutes } from '../src/docs.js';

const request: RawRequest = { params: {}, query: {}, headers: {}, body: undefined, raw: undefined };
const document = generateOpenApi({ info: { title: 'Orders <API>', version: '1.0.0' }, routes: [] });

const find = (routes: readonly Route[], path: string): Route => {
  const route = routes.find((candidate) => candidate.path === path);

  if (!route) throw new Error(`no route at ${path}`);

  return route;
};

describe('openApiDocsRoutes', () => {
  it('serves the contract as JSON', async () => {
    const response = await executeRoute(find(openApiDocsRoutes(document), '/openapi.json'), request);

    expect(response.headers['content-type']).toContain('application/json');
    expect(JSON.parse(String(response.body)).openapi).toBe('3.1.0');
  });

  it.each(['swagger', 'scalar', 'redoc'] as const)('serves a %s page pointing at the contract', async (ui) => {
    const routes = openApiDocsRoutes(document, { ui, jsonPath: '/api/openapi.json', uiPath: '/api/docs' });
    const response = await executeRoute(find(routes, '/api/docs'), request);

    expect(response.headers['content-type']).toContain('text/html');
    expect(String(response.body)).toContain('/api/openapi.json');
    expect(String(response.body)).toContain('Orders &#60;API&#62;');
  });
});
