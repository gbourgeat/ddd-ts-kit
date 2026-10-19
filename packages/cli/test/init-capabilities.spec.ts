import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers.js';
import { initFailure } from './support/init-failure.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';
import { textsAt } from './support/texts-at.js';
import { KIT_RANGE } from './support/kit-range.js';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

describe('integration events', () => {
  it('behind a broker, hands each context the subscriber of its own name through the kernel port', () => {
    const root = initProject('--broker', 'rabbitmq');

    expect(platform(root, 'platform.module.ts')).toContain(
      'builder.rebind(EventSubscribers).toValue({ forContext: (name) => options.events.forConsumer(name) });',
    );

    expect(platform(root, 'events/create-event-provider.ts')).toContain(
      'forConsumer: (name) => bus.forConsumer(name),',
    );

    expect(platform(root, 'config/load-config.ts')).toContain("amqpUrl: readUrl(env, 'AMQP_URL', problems),");
    expect(read(root, 'docker-compose.yml')).toContain('image: rabbitmq:4-management-alpine');

    expect(textsAt(readJson(root, 'package.json'), 'dependencies')).toMatchObject({
      '@ddd-ts-kit/rabbitmq': KIT_RANGE,
      amqplib: '^2.2.0',
    });
  });

  it.each(['rabbitmq', 'kafka', 'nats', 'redis'])(
    'accepts discovery behind the broker %s, with the same line for a context as without one',
    (broker) => {
      const root = initProject(
        '--assembly',
        'discovery',
        '--broker',
        broker,
        '--orm',
        'knex',
        '--context',
        'billing:core',
      );

      expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack')).toMatchObject({
        assembly: 'discovery',
        broker,
      });

      expect(platform(root, 'compose-application.ts')).toContain(
        "await discoverContext('billing', new URL('../contexts/billing/', import.meta.url)),",
      );

      expect(platform(root, 'compose-application.ts')).not.toContain('listeningContext');
      expect(platform(root, 'platform.module.ts')).toContain('builder.rebind(EventSubscribers)');
    },
  );

  it('gives the audit trail a subscriber of its own name, through the same port', () => {
    const module = platform(initProject('--broker', 'nats'), 'audit/audit.module.ts');

    expect(module).toContain(
      'subscribeAll(resolve(EventSubscribers).forContext(audit.consumer), audit.subscriptions);',
    );

    expect(module).toContain('builder.bind(AuditTrail).toValue(audit.trail);');
    expect(module).toContain('.handledBy(SearchAuditEntriesHandler, [AuditReader]);');
  });

  it('keeps the events in the process without a broker, relayed from the outbox', () => {
    const root = initProject();

    const relay =
      'const relay = startOutboxRelay({\n  store: persistence.outbox,\n  publisher: application.eventBus,\n  intervalMs: config.outboxRelayIntervalMs,\n  logger: application.logger,\n});';

    expect(read(root, 'src/main.ts')).toContain(relay);
    expect(read(root, 'src/main.ts')).toContain('events: inProcessEvents(),');
    expect(exists(root, 'src/platform/events/create-event-provider.ts')).toBe(false);
    expect(platform(root, 'platform.module.ts')).not.toContain('EventSubscribers');
  });

  it('orders the events of an aggregate on Kafka, in the bus and in the relay', () => {
    const root = initProject('--broker', 'kafka');

    expect(platform(root, 'events/aggregate-key-of.ts')).toContain(
      'export function aggregateKeyOf(event: IntegrationEvent): string | undefined',
    );

    expect(platform(root, 'events/start-outbox-relay.ts')).toContain(
      "ordering: 'per-key',\n    keyOf: aggregateKeyOf,",
    );
  });

  it('refuses a broker without a database, and still accepts a broker of your own', () => {
    const root = initProject('--broker', 'custom');

    expect(initFailure('--broker', 'rabbitmq', '--orm', 'none').code).toBe(2);

    expect(platform(root, 'events/custom-event-bus.ts')).toContain(
      'private readonly delivery = new InMemoryEventBus();',
    );

    expect(exists(root, 'src/platform/events/custom-event-bus.contract.spec.ts')).toBe(true);
  });
});

describe('authentication and authorization', () => {
  it.each([
    ['rbac', 'roles/roles.ts', 'new RoleBasedAuthorizer({ roles, systemRole: Role.System })'],
    ['abac', 'attributes/attribute-policies.ts', 'policies: attributePolicies'],
    [
      'rebac',
      'relationships/relationship-schema.ts',
      'schema: relationshipSchema,\n    store: relationTuples,\n    mapping: permissionMapping(),',
    ],
    ['custom', 'custom/custom-authorizer.contract.spec.ts', 'permissions.all()'],
  ])('writes the authorizer of the model %s behind the one port', (authz, file, expected) => {
    const root = initProject('--authz', authz);

    expect(exists(root, `src/platform/auth/${file}`)).toBe(true);
    expect(platform(root, 'auth/authorization/create-authorizer.ts')).toContain(expected);

    expect(platform(root, 'auth/authorization/authorization.ts')).toContain(
      'return authorizationModule({ authorizer: createAuthorizer(), authenticator, policies: accessPolicies, onDecision });',
    );

    expect(platform(root, 'compose-application.ts')).toContain("authorization: 'required'");

    expect(platform(root, 'auth/authentication/http-boundary.ts')).toContain(
      'resolvePrincipal: principalOf(authenticator),\n    executionScope,\n    errorMapper,',
    );
  });

  it('keeps a registry of every permission where the model is laid out over it', () => {
    const root = initProject('--authz', 'rebac');

    expect(platform(root, 'auth/authorization/permissions.ts')).toContain(
      'export const permissions = PermissionRegistry.of(',
    );

    expect(platform(root, 'auth/authorization/permissions.ts')).toContain('// ddd-ts-kit:permission-sets');
    expect(exists(root, 'src/platform/auth/relationships/create-tuple-store.contract.spec.ts')).toBe(true);

    expect(read(root, 'test/e2e/support/start-application.ts')).toContain(
      'relate: (tuple) => relationTuples.write([tuple]),',
    );
  });

  it('writes a development authenticator that refuses production, when no credential is verified', () => {
    const root = initProject('--authn', 'none');

    expect(platform(root, 'auth/authentication/development-header-authenticator.ts')).toContain(
      'must never run in production',
    );

    expect(platform(root, 'auth/authentication/security-schemes.ts')).toContain('developmentActor');

    expect(platform(root, 'auth/authentication/principal-of.ts')).toContain(
      'resolveSession(authenticator, developmentActorOf(raw))',
    );

    expect(read(root, 'test/e2e/support/create-credentials.ts')).toContain(
      "new DevelopmentHeaderAuthenticator('test')",
    );
  });

  it('logs the authorization decisions when the audit trail is off, and writes no audit file', () => {
    const root = initProject('--audit', 'off');

    expect(platform(root, 'lay-foundations.ts')).toContain('decisions: logDecisions(logger),');

    expect(platform(root, 'compose-application.ts')).toContain(
      'const guard = authorization(foundations.decisions, options.authenticator);',
    );

    expect(exists(root, 'src/platform/audit/create-audit.ts')).toBe(false);
    expect(platform(root, 'compose-application.ts')).not.toContain('auditModule');
  });
});

describe('what the stack does not have', () => {
  it('skips the HTTP pieces when there is no HTTP stack', () => {
    const root = initProject('--http', 'none', '--di', 'manual');

    expect(exists(root, 'scripts/openapi.ts')).toBe(false);
    expect(exists(root, 'src/platform/http')).toBe(false);
    expect(exists(root, 'src/platform/auth/authentication/create-authenticator.ts')).toBe(false);
    expect(exists(root, 'test/e2e')).toBe(false);
    expect(textsAt(readJson(root, 'package.json'), 'scripts')['openapi:check']).toBeUndefined();
    expect(read(root, '.github/workflows/ci.yml')).not.toContain('openapi');
  });

  it('leaves out the database, the relay and the documentation page', () => {
    const root = initProject('--orm', 'none', '--docs-ui', 'none');
    const scripts = textsAt(readJson(root, 'package.json'), 'scripts');

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack')).toMatchObject({
      orm: 'none',
      database: 'none',
      events: 'in-memory',
    });

    expect(exists(root, 'src/platform/http/with-documentation.ts')).toBe(false);
    expect(exists(root, 'src/platform/events/start-outbox-relay.ts')).toBe(false);
    expect(exists(root, 'src/platform/database/schema.ts')).toBe(false);
    expect(read(root, 'docker-compose.yml')).not.toContain('postgres');
    expect(platform(root, 'config/load-config.ts')).not.toContain('DATABASE_URL');
    expect(scripts['db:migrate']).toBe('echo "No database to migrate."');
    expect(scripts['db:generate']).toBeUndefined();
  });

  it('validates the database URL at boot and mounts the documentation page that was chosen', () => {
    const root = initProject('--docs-ui', 'scalar');

    expect(platform(root, 'config/load-config.ts')).toContain("databaseUrl: readUrl(env, 'DATABASE_URL', problems),");

    expect(platform(root, 'http/with-documentation.ts')).toContain(
      "openApiDocumentsRoutes(documents, { ui: 'scalar', title: config.serviceName })",
    );

    expect(platform(root, 'http/start-http-server.ts')).toContain(
      'mountExpress(app, withDocumentation(served.routes, config, served.boundary), served.boundary);',
    );

    expect(read(root, 'scripts/openapi.ts')).toContain('errorMapper: application.boundary.errorMapper,');
  });
});
