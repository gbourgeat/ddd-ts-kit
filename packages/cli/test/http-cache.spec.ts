import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, walk } from './helpers.js';
import { initFailure } from './support/init-failure.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';

const TERMS = ['--term', 'Get=to read', '--term', 'Invoice=a bill', '--term', 'Read=to look', '--term', 'Prices=costs'];
const HTTP = 'src/contexts/billing/presentation/http';

describe('init --http-cache', () => {
  it('records the choice, none unless asked, and a config without it means none', () => {
    expect(jsonAt(readJson(initProject(), 'ddd-ts-kit.config.json'), 'stack', 'httpCache')).toBe('none');

    expect(
      jsonAt(readJson(initProject('--http-cache', 'varnish'), 'ddd-ts-kit.config.json'), 'stack', 'httpCache'),
    ).toBe('varnish');

    expect(cli(initProject(), '--help').stdout).toContain('[--http-cache none|varnish]');
  });

  it('puts Varnish in front of the API: its service, its VCL, its address, the tags of the answers and the purges of the relay', () => {
    const root = initProject('--http-cache', 'varnish');

    expect(read(root, 'docker-compose.yml')).toContain('  varnish:\n    image: varnish:9.1.0');
    expect(read(root, 'docker/varnish/default.vcl')).toContain('xkey.purge(req.http.xkey-purge)');
    expect(read(root, '.env.example')).toContain('VARNISH_URL=http://localhost:6081');

    expect(read(root, 'src/platform/config/load-config.ts')).toContain(
      "varnishUrl: readUrl(env, 'VARNISH_URL', problems),",
    );

    expect(read(root, 'src/platform/auth/http-boundary.ts')).toContain('cacheTags: { header: CacheTagHeader.xkey },');

    expect(read(root, 'src/main.ts')).toContain(
      'publisher: new PurgingPublisher(new VarnishCachePurger({ url: config.varnishUrl }), application.eventBus),',
    );

    expect(read(root, 'test/e2e/support/test-environment.ts')).toContain("'http://varnish.e2e.test'");
  });

  it('refuses a shared cache without an API, or without the outbox its purges ride on', () => {
    const inMemory = initFailure('--http-cache', 'varnish', '--orm', 'none');
    const unknown = initFailure('--http-cache', 'squid');

    expect(inMemory.message).toBe('--http-cache varnish cannot be combined with --http express --events in-memory.');
    expect(inMemory.fix).toContain('keep an HTTP framework and --events outbox');
    expect(unknown.message).toBe('Unknown value "squid" for --http-cache.');
  });

  it('leaves no trace of Varnish in a project that asks for none', () => {
    const root = initProject();

    expect(exists(root, 'docker/varnish/default.vcl')).toBe(false);

    expect(walk(root).filter((file) => file !== 'ddd-ts-kit.config.json' && /varnish/i.test(read(root, file)))).toEqual(
      [],
    );
  });
});

describe('generate controller --cache', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core');

    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', ...TERMS);
    cli(root, 'generate', 'query', 'billing', 'GetInvoice', '--permission', 'invoice.read', ...TERMS);
    cli(root, 'generate', 'query', 'billing', 'ReadPrices', '--public', ...TERMS);
  });

  const controller = (...flags: readonly string[]) => cli(root, 'generate', 'controller', 'billing', ...flags);

  it('writes a private policy revalidated with an ETag on the read of a caller', () => {
    expect(
      controller('GetInvoice', '--query', '--method', 'GET', '--path', '/invoices/:invoiceId', '--cache', 'private')
        .code,
    ).toBe(0);

    const written = read(root, `${HTTP}/invoices/get-invoice/get-invoice.controller.ts`);

    expect(written).toContain("import { CacheScope, Controller, type HttpRequest } from '@ddd-ts-kit/http';");

    expect(written).toContain(
      "cache: { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' },",
    );
  });

  it('writes a public policy tagged with the resources of its path on a public read', () => {
    expect(
      controller('ReadPrices', '--query', '--method', 'GET', '--path', '/prices/:productId', '--cache', 'public').code,
    ).toBe(0);

    const written = read(root, `${HTTP}/prices/read-prices/read-prices.controller.ts`).replace(/\s+/g, ' ');

    expect(written).toContain("scope: CacheScope.public, maxAge: '1m', sMaxAge: '5m', staleWhileRevalidate: '30s'");
    expect(written).toContain("tags: [{ resource: 'product', param: 'productId' }]");
  });

  it('refuses a policy no cache may keep: a public answer behind a group that knows its caller, a cached write', () => {
    const shared = controller(
      'GetInvoice',
      '--query',
      '--method',
      'GET',
      '--path',
      '/invoices/:invoiceId/copy',
      '--cache',
      'public',
    );

    const write = controller(
      'GetInvoice',
      '--query',
      '--method',
      'POST',
      '--path',
      '/invoices/:invoiceId/copy',
      '--cache',
      'private',
    );

    const unknown = controller(
      'GetInvoice',
      '--query',
      '--method',
      'GET',
      '--path',
      '/invoices/:invoiceId/copy',
      '--cache',
      'forever',
    );

    expect(shared.stderr).toContain(
      '--cache public on a route behind the group InvoicesRoutes, which knows its caller',
    );

    expect(write.stderr).toContain('--cache private on a POST route');
    expect(unknown.stderr).toContain('Unknown cache policy "forever".');
  });
});
