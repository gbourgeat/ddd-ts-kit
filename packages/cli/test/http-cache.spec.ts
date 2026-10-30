import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, walk } from './helpers';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';

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
    expect(read(root, 'docker-compose.yml')).toContain('VARNISH_PURGE_KEY: ${VARNISH_PURGE_KEY:-}');
    expect(read(root, 'docker/varnish/default.vcl')).toContain('xkey.purge(req.http.xkey-purge)');
    expect(read(root, '.env.example')).toContain('VARNISH_URL=http://localhost:6081');
    expect(read(root, '.env.example')).toContain('VARNISH_PURGE_KEY=local-purge-key');

    expect(read(root, 'src/platform/config/load-config.ts')).toContain(
      "varnishUrl: env.url('VARNISH_URL'),\n    varnishPurgeKey: env.text('VARNISH_PURGE_KEY'),",
    );

    expect(read(root, 'src/platform/auth/authentication/http-boundary.ts')).toContain(
      'cacheTags: { header: CacheTagHeader.xkey },',
    );

    expect(read(root, 'src/platform/auth/authentication/http-boundary.ts')).not.toContain('resolveTenant');

    expect(read(root, 'src/main.ts').replace(/\s+/g, ' ')).toContain(
      'publisher: new PurgingPublisher( new VarnishCachePurger({ url: config.varnishUrl, key: config.varnishPurgeKey }), application.eventBus, ),',
    );

    expect(read(root, 'test/e2e/support/test-environment.ts')).toContain("'http://varnish.e2e.test'");
    expect(read(root, 'test/e2e/support/test-environment.ts')).toContain("'e2e-purge-key'");
  });

  it('keeps only what an answer allows by name, and lets a purge in from this machine or with the key alone', () => {
    const vcl = read(initProject('--http-cache', 'varnish'), 'docker/varnish/default.vcl');

    expect(vcl).toContain('set beresp.uncacheable = true;');
    expect(vcl).toContain('req.http.x-purge-key == std.getenv("VARNISH_PURGE_KEY")');
    expect(vcl).not.toContain('"10.0.0.0"/8');
    expect(vcl).toContain('if (!std.ban(');
  });

  it('records the purges of the relay in the end-to-end application instead of sending them to Varnish', () => {
    const root = initProject('--http-cache', 'varnish');
    const started = read(root, 'test/e2e/support/start-application.ts');

    expect(started).toContain('readonly purges: InMemoryCachePurger;');
    expect(started).toContain('publisher: new PurgingPublisher(purges, application.eventBus),');
    expect(read(initProject(), 'test/e2e/support/start-application.ts')).not.toContain('Purg');
  });

  it('hands the purges of a context run alone to Varnish too', () => {
    const root = initProject('--http-cache', 'varnish', '--context', 'billing:core');

    expect(cli(root, 'generate', 'service', 'billing').code).toBe(0);

    expect(read(root, 'src/apps/billing/main.ts').replace(/\s+/g, ' ')).toContain(
      'publisher: new PurgingPublisher( new VarnishCachePurger({ url: config.varnishUrl, key: config.varnishPurgeKey }),',
    );
  });

  it('files the tags under the tenant on the answers and on the purges alike, in a multi-tenant project', () => {
    const shared = initProject('--http-cache', 'varnish', '--tenancy', 'shared-table');
    const single = initProject('--http-cache', 'varnish');

    expect(read(shared, 'src/platform/auth/authentication/http-boundary.ts')).toContain(
      'cacheTags: { header: CacheTagHeader.xkey, perTenant: true },\n    resolveTenant: tenantFromHeader(),',
    );

    expect(read(shared, 'src/platform/composition/compose-application.ts')).toContain('perTenant: true,');
    expect(read(single, 'src/platform/composition/compose-application.ts')).not.toContain('perTenant');
  });

  it('gives a project wired by hand, or by Nest, the invalidation its handlers ask, per tenant when it is multi-tenant', () => {
    const byHand = initProject('--http-cache', 'varnish', '--di', 'manual', '--tenancy', 'shared-table');
    const nest = initProject('--http-cache', 'varnish', '--di', 'nest', '--http', 'nest');
    const without = initProject('--di', 'manual');

    expect(read(byHand, 'src/platform/composition/platform.ts')).toContain(
      'readonly cacheInvalidation: CacheInvalidation;',
    );

    expect(read(byHand, 'src/platform/events/platform-events.ts')).toContain(
      'cacheInvalidation: new PublishedCacheInvalidation({ publisher, ids, clock, scope, perTenant: true }),',
    );

    expect(read(byHand, 'src/platform/auth/authentication/http-boundary.ts')).toContain(
      'resolveTenant: tenantFromHeader(),',
    );

    expect(read(nest, 'src/platform/events/platform-events.ts')).toContain(
      'cacheInvalidation: new PublishedCacheInvalidation({ publisher, ids, clock, scope }),',
    );

    expect(read(without, 'src/platform/composition/platform.ts')).not.toContain('CacheInvalidation');
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

describe('init --http-cache, what it refuses', () => {
  it('refuses a shared cache without an API, or without the outbox its purges ride on, naming what was passed', () => {
    const noApi = initFailure('--http-cache', 'varnish', '--http', 'none');
    const noOutboxByDefault = initFailure('--http-cache', 'varnish', '--orm', 'none');
    const noOutbox = initFailure('--http-cache', 'varnish', '--orm', 'none', '--events', 'in-memory');
    const noOutboxByDatabase = initFailure('--http-cache', 'varnish', '--database', 'none');
    const neither = initFailure('--http-cache', 'varnish', '--http', 'none', '--orm', 'none');
    const unknown = initFailure('--http-cache', 'squid');

    expect(noApi.message).toBe(
      '--http-cache varnish needs an HTTP framework to put the cache in front of: this project has --http none.',
    );

    expect(noOutboxByDefault.message).toBe(
      '--http-cache varnish needs --events outbox for its purge requests: this project has --events in-memory, the default of --orm none.',
    );

    expect(noOutbox.message).toBe(
      '--http-cache varnish needs --events outbox for its purge requests: this project has --events in-memory.',
    );

    expect(noOutboxByDatabase.message).toBe(
      '--http-cache varnish needs --events outbox for its purge requests: this project has --events in-memory, the default of --database none.',
    );

    expect(neither.message).toBe(
      '--http-cache varnish needs an HTTP framework to put the cache in front of and --events outbox for its purge requests: this project has --http none and --events in-memory, the default of --orm none.',
    );

    expect(noOutbox.fix).toContain('keep an HTTP framework and --events outbox');
    expect(unknown.message).toBe('Unknown value "squid" for --http-cache.');
  });
});
