import type { Config } from '../../config/index.js';
import { pipelineManifest } from './pipeline-manifest.js';
import { VERSIONS } from './versions.js';

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
  '@opentelemetry/auto-instrumentations-node',
  '@opentelemetry/exporter-trace-otlp-http',
];

const BASE_DEV = ['ddd-ts-kit', 'tsx', '@types/node', '@ddd-ts-kit/testing', '@faker-js/faker'];

/** What `@ddd-ts-kit/tracing/testing` is written against: the end-to-end specs assert the trace of a request. */
const TRACE_ASSERTIONS = ['@opentelemetry/sdk-trace-base', '@opentelemetry/context-async-hooks'];

/** What each choice of the stack adds: [runtime dependencies, development dependencies]. */
const BY_CHOICE: Readonly<Record<string, readonly [readonly string[], readonly string[]]>> = {
  'http:express': [
    ['@ddd-ts-kit/http', 'express'],
    ['@types/express', ...TRACE_ASSERTIONS],
  ],
  'http:fastify': [['@ddd-ts-kit/http', 'fastify'], TRACE_ASSERTIONS],
  'http:nest': [
    ['@ddd-ts-kit/http', '@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'],
    TRACE_ASSERTIONS,
  ],
  'di:tsyringe': [['@ddd-ts-kit/di', 'tsyringe', 'reflect-metadata'], []],
  // By hand the platform builds the job scheduler itself; on tsyringe the kernel module of @ddd-ts-kit/di brings it.
  'di:manual': [['@ddd-ts-kit/scheduling'], []],
  'di:nest': [['@ddd-ts-kit/scheduling'], []],
  'validation:zod': [['zod'], []],
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
  'cache:redis': [['@ddd-ts-kit/redis', 'ioredis'], []],
  'audit:on': [['@ddd-ts-kit/audit'], []],
  // The adapter, and the SDK it is written against; `@opentelemetry/api`, which links a report to its trace, is in the base.
  'errors:sentry': [['@ddd-ts-kit/sentry', '@sentry/node'], []],
  // The pretty format of pino is a transport of its own, loaded by name when `LOG_FORMAT=pretty`: knip knows it as a peer of the adapter.
  'logger:pino': [['@ddd-ts-kit/pino', 'pino', 'pino-pretty'], []],
  'logger:winston': [['@ddd-ts-kit/winston', 'winston'], []],
  'broker:rabbitmq': [['@ddd-ts-kit/rabbitmq', 'amqplib'], []],
  'broker:redis': [['@ddd-ts-kit/redis', 'ioredis'], []],
  'broker:kafka': [['@ddd-ts-kit/kafka', '@confluentinc/kafka-javascript'], []],
  'broker:nats': [['@ddd-ts-kit/nats', '@nats-io/jetstream', '@nats-io/transport-node'], []],
  'tests:vitest': [[], ['vitest']],
  'tests:jest': [[], ['jest', '@jest/globals', '@swc/core', '@swc/jest']],
};

export function dependenciesFor(config: Config): Packages {
  // Without an HTTP boundary nothing verifies a credential: the token library would be dead weight.
  const made = Object.entries(config.stack).filter(([key]) => key !== 'authn' || config.stack.http !== 'none');
  const choices = made.map(([key, value]) => BY_CHOICE[`${key}:${value}`] ?? [[], []]);
  const development = { ...ranges([...BASE_DEV, ...choices.flatMap(([, names]) => names)]), ...analyzers(config) };

  return {
    dependencies: sorted(ranges([...BASE, ...choices.flatMap(([runtime]) => runtime)])),
    devDependencies: sorted(development),
  };
}

function ranges(names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, VERSIONS[name] ?? 'latest']));
}

/** The analyzers of the pipeline, at its versions. The GitLab report formatter only where a GitLab pipeline uses it. */
function analyzers(config: Config): Record<string, string> {
  const { 'eslint-formatter-gitlab': gitlabFormatter, ...common } = pipelineManifest().devDependencies;
  const usesGitlab = config.stack.ci === 'gitlab' || config.stack.ci === 'both';

  return {
    ...common,
    ...(usesGitlab && gitlabFormatter !== undefined ? { 'eslint-formatter-gitlab': gitlabFormatter } : {}),
  };
}

function sorted(entries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}
