import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers.js';

const manifest = (root: string): { dependencies: Record<string, string>; scripts: Record<string, string> } =>
  JSON.parse(read(root, 'package.json')) as { dependencies: Record<string, string>; scripts: Record<string, string> };

const stack = (root: string): Record<string, string> =>
  (JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { stack: Record<string, string> }).stack;

describe('init --cache', () => {
  it('redis wires the cache, the limiter, the relay signal, the readiness probe and a Dragonfly service named cache', () => {
    const root = tempDir('operations');

    cli(root, 'init', '--cache', 'redis');

    expect(stack(root)).toMatchObject({ cache: 'redis' });

    expect(read(root, 'src/platform/redis/open-redis.ts')).toContain(
      'new RedisCache(connection.client, { namespace: serviceName, metrics })',
    );

    expect(read(root, 'src/platform/buses/create-command-bus.ts')).toContain(
      'relayWakeUpMiddleware(redis.relaySignal)',
    );

    expect(read(root, 'src/main.ts')).toContain('wakeOn: redis.relaySignal');
    expect(read(root, 'src/platform/http/refusal-for.ts')).toContain("'retry-after'");
    expect(read(root, 'src/platform/http/start-http-server.ts')).toContain("app.get(\n    '/health/ready',");
    expect(read(root, 'src/platform/config/load-config.ts')).toContain("redisUrl: readUrl(env, 'REDIS_URL', problems)");

    expect(read(root, 'docker-compose.yml')).toMatch(
      /\n {2}cache:\n {4}image: docker\.dragonflydb\.io\/dragonflydb\/dragonfly:v2\.0\.2\n[\s\S]*healthcheck:\n {6}test: \["CMD", "redis-cli", "ping"\]/,
    );

    expect(manifest(root).dependencies).toMatchObject({ '@ddd-ts-kit/redis': '^0.1.0', ioredis: '^6.0.0' });
  });

  it('none leaves the cache in the process and writes nothing about Redis', () => {
    const root = tempDir('operations');

    cli(root, 'init');

    expect(stack(root)).toMatchObject({ cache: 'none' });
    expect(exists(root, 'src/platform/redis/open-redis.ts')).toBe(false);
    expect(read(root, 'docker-compose.yml')).not.toContain('dragonfly');
    expect(cli(tempDir('operations'), 'init', '--cache', 'memcached').code).toBe(2);
  });
});

describe('init --authn keycloak', () => {
  it('verifies the tokens of a realm and ships that realm for a local Keycloak behind the identity profile', () => {
    const root = tempDir('operations');

    cli(root, 'init', '--authn', 'keycloak');
    const project = (JSON.parse(read(root, 'package.json')) as { name: string }).name;

    const realm = JSON.parse(read(root, `docker/keycloak/${project}-realm.json`)) as {
      realm: string;
      clients: { clientId: string; publicClient: boolean; directAccessGrantsEnabled: boolean }[];
      roles: { realm: { name: string }[] };
      users: { username: string; realmRoles: string[] }[];
    };

    expect(read(root, 'src/platform/auth/create-authenticator.ts')).toContain(
      'keycloakAuthenticator({ baseUrl, realm, audience',
    );

    expect(read(root, 'src/platform/config/load-config.ts')).toContain("readUrl(env, 'KEYCLOAK_URL', problems)");

    expect(read(root, 'docker-compose.yml')).toMatch(
      /\n {2}keycloak:\n {4}image: quay\.io\/keycloak\/keycloak:26\.8\.0\n {4}profiles: \[identity\]\n {4}command: \["start-dev", "--import-realm"\]/,
    );

    expect(realm.realm).toBe(project);

    expect(
      realm.clients.map((client) => [client.clientId, client.publicClient, client.directAccessGrantsEnabled]),
    ).toEqual([
      [`${project}-api`, false, false],
      [`${project}-local`, true, true],
    ]);

    expect(read(root, `docker/keycloak/${project}-realm.json`)).toContain('"protocolMapper": "oidc-audience-mapper"');
    expect(realm.roles.realm.map((role) => role.name)).toEqual(['admin']);

    expect(realm.users.map((user) => [user.username, user.realmRoles])).toEqual([
      ['demo-admin', ['admin']],
      ['demo-user', []],
    ]);

    expect(read(root, '.env.example')).toContain('are for local development ONLY');

    expect(read(root, 'test/e2e/support/create-credentials.ts')).toContain(
      'realm_access: { roles: actor.roles ?? [] }',
    );
  });
});

describe('init --audit', () => {
  it('is on with a database: tables in the first migration, the three sources, a protected paginated route in the platform', () => {
    const root = tempDir('operations');

    cli(root, 'init', '--orm', 'knex');

    expect(stack(root)).toMatchObject({ audit: 'on' });

    expect(read(root, 'src/platform/database/schema.ts')).toContain(
      'await createAuditTables(knex, { schema: AUDIT_SCHEMA });',
    );

    expect(read(root, 'src/platform/audit/create-audit.ts')).toContain(
      'new KnexAuditTrail(persistence.database, { schema: AUDIT_SCHEMA })',
    );

    expect(read(root, 'src/platform/audit/create-audit.ts')).toMatch(
      /decisions: auditDecisions\([\s\S]*commands: auditMiddleware\([\s\S]*subscriptions: auditIntegrationEvents\(/,
    );

    expect(read(root, 'src/platform/audit/search-audit-entries.route.ts')).toContain("path: '/audit/entries'");
    expect(read(root, 'src/platform/audit/audit.module.ts')).toContain(".requires(auditPermissions['trail.read'])");
    expect(exists(root, 'src/platform/auth/log-decisions.ts')).toBe(false);
    expect(manifest(root).dependencies).toMatchObject({ '@ddd-ts-kit/audit': '^0.1.0' });
  });

  it('keeps the trail in memory behind a TODO where the audit package has no store, and is off without a database', () => {
    const prisma = tempDir('operations');

    cli(prisma, 'init', '--orm', 'prisma');
    const bare = tempDir('operations');

    cli(bare, 'init', '--orm', 'none');
    const off = tempDir('operations');

    cli(off, 'init', '--audit', 'off');

    expect(read(prisma, 'src/platform/audit/create-audit.ts')).toMatch(
      /TODO\(platform\): the audit package stores on knex and drizzle only[\s\S]*new InMemoryAuditTrail\(\)/,
    );

    expect(stack(bare)).toMatchObject({ audit: 'off' });
    expect(stack(off)).toMatchObject({ audit: 'off' });
    expect(exists(off, 'src/platform/audit/create-audit.ts')).toBe(false);
    expect(read(off, 'src/platform/auth/log-decisions.ts')).toContain("logger.warn('authorization decision', fields)");
  });
});

describe('generate query --search and generate adapter', () => {
  function project(...flags: string[]): string {
    const root = tempDir('operations');

    cli(root, 'init', ...flags);

    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Search=To show invoices',
    );

    return root;
  }

  it('writes a paginated query whose handler hands the access scope of the actor to the read port', () => {
    const root = project();

    expect(
      cli(root, 'generate', 'query', 'billing', 'SearchInvoices', '--permission', 'invoice.search', '--search').code,
    ).toBe(0);

    cli(root, 'generate', 'route', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/invoices');

    expect(read(root, 'src/contexts/billing/application/queries/search-invoices/search-invoices.query.ts')).toContain(
      'readonly page: PageRequest<SearchInvoicesSort>',
    );

    expect(read(root, 'src/contexts/billing/application/queries/search-invoices/search-invoices.handler.ts')).toContain(
      "this.access.scope(query.actor, billingPermissions['invoice.search'], 'invoice')",
    );

    expect(read(root, 'src/contexts/billing/application/ports/search-invoices-reader.port.ts')).toContain(
      'abstract search(scope: AccessScope, page: PageRequest<SearchInvoicesSort>): Promise<SearchInvoicesResult>;',
    );

    expect(read(root, 'src/contexts/billing/presentation/http/search-invoices.route.ts')).toMatch(
      /pageQuerySchema\([\s\S]*pageSchemaOf\(line\)[\s\S]*pageResponse\(page,/,
    );

    expect(
      cli(root, 'generate', 'query', 'billing', 'SearchInvoiceLines', '--public', '--search', '--allow-name').code,
    ).toBe(2);
  });

  it('binds an adapter with its own policy, or lets the class carry it as standard decorators', () => {
    const root = project('--style', 'explicit');

    cli(root, 'generate', 'port', 'billing', 'PaymentGateway');
    cli(root, 'generate', 'port', 'billing', 'TaxRates');
    expect(cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway').code).toBe(0);
    expect(cli(root, 'generate', 'adapter', 'billing', 'TaxRates', '--kind', 'gateway', '--decorators').code).toBe(0);

    const module = read(root, 'src/contexts/billing/billing.module.ts');

    expect(module).toContain(
      "builder\n      .bind(PaymentGateway)\n      .toClass(RemotePaymentGateway)\n      .as('external')\n      .with(ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000)));",
    );

    expect(module).toContain("builder.bind(TaxRates).toClass(RemoteTaxRates).as('gateway').with(ownPolicy());");

    expect(read(root, 'src/contexts/billing/infrastructure/external/remote-tax-rates.adapter.ts')).toContain(
      "import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';",
    );

    expect(read(root, 'vitest.config.ts')).toContain("import { decorators } from '@ddd-ts-kit/testing/vitest';");
    expect(cli(root, 'generate', 'adapter', 'billing', 'Unknown').code).toBe(2);
    expect(cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway', '--kind', 'queue', '--force').code).toBe(2);
  });

  it('takes --decorators where decorator syntax has its legacy meaning too: the aspects serve both modes', () => {
    const root = project('--validation', 'class-validator', '--style', 'explicit');

    cli(root, 'generate', 'port', 'billing', 'PaymentGateway');

    expect(cli(root, 'generate', 'adapter', 'billing', 'PaymentGateway', '--decorators').code).toBe(0);

    expect(read(root, 'src/contexts/billing/infrastructure/external/remote-payment-gateway.adapter.ts')).toContain(
      '@Retry({ attempts: 3, backoff: { baseMs: 100 } })',
    );

    expect(read(root, 'src/contexts/billing/billing.module.ts')).toContain(
      "builder.bind(PaymentGateway).toClass(RemotePaymentGateway).as('external').with(ownPolicy());",
    );

    expect(read(root, 'vitest.config.ts')).not.toContain('decorators(');
  });
});
