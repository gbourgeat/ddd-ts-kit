import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';

const SERVER = 'src/platform/http/start-http-server.ts';
const VOID = 'src/contexts/billing/presentation/http/invoices/void-invoice/void-invoice.controller.ts';

describe('init on Hono and TypeBox', () => {
  it('serves the routes with Hono on Node, and installs Hono, its Node server and TypeBox', () => {
    const root = initProject('--http', 'hono', '--validation', 'typebox', '--context', 'billing:core');
    const manifest = readJson(root, 'package.json');

    expect(read(root, SERVER)).toContain('mountHono(app, withDocumentation(served.routes, config), served.boundary);');
    expect(read(root, SERVER)).toContain('const server = serve({ fetch: app.fetch, port }, () => resolve(server));');

    expect(jsonAt(manifest, 'dependencies')).toMatchObject({
      hono: expect.any(String),
      '@hono/node-server': expect.any(String),
      typebox: expect.any(String),
    });
  });

  it('puts the limiter and the readiness probe in front of the routes when the cache is shared', () => {
    const root = initProject('--http', 'hono', '--cache', 'redis', '--context', 'billing:core');

    expect(read(root, SERVER)).toContain("app.get('/health/ready', async (context) => {");
    expect(read(root, SERVER)).toContain('getConnInfo(context).remote.address');
  });

  it('declares the schemas of a route with TypeBox, its path parameters typed', () => {
    const root = initProject('--http', 'fastify', '--validation', 'typebox', '--context', 'billing:core');

    cli(root, 'generate', 'command', 'billing', 'VoidInvoice', '--permission', 'invoice.void', '--allow-name');
    cli(root, 'generate', 'route', 'billing', 'VoidInvoice', '--method', 'POST', '--path', '/invoices/:invoiceId/void');

    const controller = read(root, VOID);

    expect(controller).toContain("import Type from 'typebox';");

    expect(controller).toContain(
      'const params = typeboxSchema(Type.Object({ invoiceId: Type.String({ minLength: 1 }) }));',
    );

    expect(controller).toContain('HttpRequest<{ params: Infer<typeof params>; body: Infer<typeof body> }>');
  });

  it('writes a function route with TypeBox too', () => {
    const root = initProject('--validation', 'typebox', '--routes', 'functions', '--context', 'billing:core');

    cli(root, 'generate', 'command', 'billing', 'VoidInvoice', '--permission', 'invoice.void', '--allow-name');
    cli(root, 'generate', 'route', 'billing', 'VoidInvoice', '--method', 'POST', '--path', '/invoices/:invoiceId/void');

    expect(read(root, 'src/contexts/billing/presentation/http/void-invoice.route.ts')).toContain(
      'const params = typeboxSchema(Type.Object({ invoiceId: Type.String({ minLength: 1 }) }));',
    );
  });
});
