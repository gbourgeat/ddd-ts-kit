import type { Config } from '../../config';
import { pipelineManifest } from './pipeline-manifest';
import { VERSIONS } from './versions';

export interface Packages {
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

const BASE = [
  '@ddd-ts-kit/kernel',
  '@ddd-ts-kit/auth',
  '@ddd-ts-kit/events',
  '@ddd-ts-kit/validation',
  '@ddd-ts-kit/tracing',
  '@ddd-ts-kit/aspects',
  '@opentelemetry/api',
  '@opentelemetry/sdk-node',
  '@opentelemetry/resources',
  '@opentelemetry/auto-instrumentations-node',
  '@opentelemetry/exporter-trace-otlp-http',
];

const BASE_DEV = ['ddd-ts-kit', 'tsx', '@types/node', '@ddd-ts-kit/testing', '@faker-js/faker'];

/** What `@ddd-ts-kit/tracing/testing` is written against: the end-to-end specs assert the trace of a request. */
const TRACE_ASSERTIONS = ['@opentelemetry/sdk-trace', '@opentelemetry/context-async-hooks'];

/** What each choice of the stack adds: [runtime dependencies, development dependencies]. */
const BY_CHOICE: Readonly<Record<string, readonly [readonly string[], readonly string[]]>> = {
  'http:express': [
    ['@ddd-ts-kit/http', 'express'],
    ['@types/express', ...TRACE_ASSERTIONS],
  ],
  'http:fastify': [['@ddd-ts-kit/http', 'fastify'], TRACE_ASSERTIONS],
  'http:hono': [['@ddd-ts-kit/http', 'hono', '@hono/node-server'], TRACE_ASSERTIONS],
  'http:nest': [
    ['@ddd-ts-kit/http', '@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'],
    TRACE_ASSERTIONS,
  ],
  'di:tsyringe': [['@ddd-ts-kit/di', 'tsyringe', 'reflect-metadata'], []],
  // By hand the platform builds the job scheduler itself; on tsyringe the kernel module of @ddd-ts-kit/di brings it.
  'di:manual': [['@ddd-ts-kit/scheduling'], []],
  'di:nest': [['@ddd-ts-kit/scheduling'], []],
  'validation:zod': [['zod'], []],
  'validation:typebox': [['typebox'], []],
  'validation:class-validator': [
    ['class-validator', 'class-transformer', 'class-validator-jsonschema', 'reflect-metadata'],
    [],
  ],
  'orm:drizzle': [
    ['@ddd-ts-kit/drizzle', 'drizzle-orm', 'pg'],
    ['drizzle-kit', '@types/pg', '@electric-sql/pglite'],
  ],
  'orm:knex': [
    ['@ddd-ts-kit/knex', 'knex', 'pg'],
    ['@types/pg', '@electric-sql/pglite', '@electric-sql/pglite-socket'],
  ],
  'orm:prisma': [
    ['@ddd-ts-kit/prisma', '@prisma/client', '@prisma/adapter-pg', 'pg'],
    ['prisma', '@types/pg', '@electric-sql/pglite', '@electric-sql/pglite-socket'],
  ],
  'orm:typeorm': [
    ['@ddd-ts-kit/typeorm', 'typeorm', 'pg'],
    ['@types/pg', '@electric-sql/pglite', '@electric-sql/pglite-socket'],
  ],
  'authn:jwt': [['jose'], []],
  'authn:keycloak': [['jose'], []],
  // The strategy of Passport verifies the tokens; jose signs those of the end-to-end tests.
  'authn:passport': [
    ['passport-jwt', 'jwks-rsa'],
    ['@types/passport-jwt', 'jose'],
  ],
  'cache:redis': [['@ddd-ts-kit/redis', 'ioredis'], []],
  // The server of oRPC, the optional peer of `@ddd-ts-kit/http/orpc`, which the HTTP server mounts under /rpc.
  'rpc:orpc': [['@orpc/server'], []],
  // The server of tRPC, the optional peer of `@ddd-ts-kit/http/trpc`, which the HTTP server mounts under /trpc.
  'rpc:trpc': [['@trpc/server'], []],
  'audit:on': [['@ddd-ts-kit/audit'], []],
  // The connector and the official SDK it is written against: the three packages are its optional peers.
  'storage:s3': [['@ddd-ts-kit/s3', '@aws-sdk/client-s3', '@aws-sdk/lib-storage', '@aws-sdk/s3-request-presigner'], []],
  // The adapter, and the SDK it is written against; `@opentelemetry/api`, which links a report to its trace, is in the base.
  'errors:sentry': [['@ddd-ts-kit/sentry', '@sentry/node'], []],
  // The pretty format of pino is a transport of its own, loaded by name when `LOG_FORMAT=pretty`: knip knows it as a peer of the adapter.
  'logger:pino': [['@ddd-ts-kit/pino', 'pino', 'pino-pretty'], []],
  'logger:winston': [['@ddd-ts-kit/winston', 'winston'], []],
  'broker:rabbitmq': [['@ddd-ts-kit/rabbitmq', 'amqplib'], []],
  'broker:redis': [['@ddd-ts-kit/redis', 'ioredis'], []],
  'broker:kafka': [['@ddd-ts-kit/kafka', '@confluentinc/kafka-javascript'], []],
  'broker:nats': [['@ddd-ts-kit/nats', '@nats-io/jetstream', '@nats-io/transport-node'], []],
  'queue:database': [['@ddd-ts-kit/scheduling'], []],
  'queue:redis': [['@ddd-ts-kit/scheduling', '@ddd-ts-kit/redis', 'ioredis'], []],
  // Mutation testing of the domain layer: the runner of Stryker reads the test config of the project.
  'tests:vitest': [[], ['vitest', '@stryker-mutator/core', '@stryker-mutator/vitest-runner']],
  'tests:jest': [
    [],
    ['jest', '@jest/globals', '@swc/core', '@swc/jest', '@stryker-mutator/core', '@stryker-mutator/jest-runner'],
  ],
};

export function dependenciesFor(config: Config): Packages {
  // Without an HTTP boundary nothing verifies a credential: the token library would be dead weight.
  const made = Object.entries(config.stack).filter(([key]) => key !== 'authn' || config.stack.http !== 'none');
  const choices = made.map(([key, value]) => BY_CHOICE[`${key}:${value}`] ?? [[], []]);
  const development = { ...ranges([...BASE_DEV, ...choices.flatMap(([, names]) => names)]), ...analyzers(config) };

  return {
    dependencies: sorted(ranges([...BASE, ...choices.flatMap(([runtime]) => runtime), ...uploads(config)])),
    devDependencies: sorted(development),
  };
}

/** The parser of the multipart uploads of `@ddd-ts-kit/http/uploads`, its optional peer, wherever files arrive over HTTP. */
function uploads(config: Config): readonly string[] {
  return config.stack.storage !== 'none' && config.stack.http !== 'none' ? ['busboy'] : [];
}

function ranges(names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, VERSIONS[name] ?? 'latest']));
}

/**
 * The analyzers of the pipeline, at its versions. The GitLab report formatter only where a GitLab
 * pipeline uses it, the coverage of Vitest only where Vitest runs the specs: Jest measures its own.
 */
function analyzers(config: Config): Record<string, string> {
  const {
    'eslint-formatter-gitlab': gitlabFormatter,
    '@vitest/coverage-v8': vitestCoverage,
    ...common
  } = pipelineManifest().devDependencies;

  const usesGitlab = config.stack.ci === 'gitlab' || config.stack.ci === 'both';

  return {
    ...common,
    ...(usesGitlab && gitlabFormatter !== undefined ? { 'eslint-formatter-gitlab': gitlabFormatter } : {}),
    ...(config.stack.tests === 'vitest' && vitestCoverage !== undefined
      ? { '@vitest/coverage-v8': vitestCoverage }
      : {}),
  };
}

function sorted(entries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}
