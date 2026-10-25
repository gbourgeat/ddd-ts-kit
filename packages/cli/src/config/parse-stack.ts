import { CliError } from '../cli-error';
import { CONFIG_FILE } from './config-file';
import { isOneOf } from './is-one-of';
import {
  ASSEMBLIES,
  AUDIT_MODES,
  AUTHN_STACKS,
  AUTHZ_STACKS,
  BROKER_STACKS,
  CACHE_STACKS,
  CI_PLATFORMS,
  DATABASE_STACKS,
  DEPENDENCY_STATEMENTS,
  DI_STACKS,
  DOCS_UIS,
  ERROR_REPORTERS,
  EVENT_SOURCING_MODES,
  EVENT_STACKS,
  HTTP_CACHE_STACKS,
  RPC_STACKS,
  HTTP_STACKS,
  LOGGERS,
  ORM_STACKS,
  PACKAGE_MANAGERS,
  PRIVACY_MODES,
  REFUSAL_FORMS,
  ROUTE_FORMS,
  FORM_MODES,
  REPRESENTATION_MODES,
  SCHEMA_FORMS,
  STORAGE_STACKS,
  STYLES,
  TENANCY_STRATEGIES,
  QUEUE_STORES,
  TEST_STACKS,
  VALIDATION_STACKS,
  VALUE_OBJECT_FORMS,
  LITERAL_FORMS,
  VALUE_FORMS,
  type Stack,
} from './stack';

type Choose = <T extends string>(key: string, values: readonly T[], fallback: T) => T;

export function parseStack(stack: Record<string, unknown>): Stack {
  const choose: Choose = (key, values, fallback) => pick(values, stack[key], { fallback, key: `stack.${key}` });
  const http = choose('http', HTTP_STACKS, 'express');
  const database = choose('database', DATABASE_STACKS, 'postgres');
  const orm = choose('orm', ORM_STACKS, 'drizzle');

  return {
    http,
    validation: choose('validation', VALIDATION_STACKS, 'zod'),
    di: choose('di', DI_STACKS, http === 'nest' ? 'nest' : 'tsyringe'),
    events: choose('events', EVENT_STACKS, database === 'none' ? 'in-memory' : 'outbox'),
    orm,
    database,
    tests: choose('tests', TEST_STACKS, 'vitest'),
    docsUi: choose('docsUi', DOCS_UIS, http === 'none' ? 'none' : 'swagger'),
    ci: choose('ci', CI_PLATFORMS, 'github'),
    ...parseChoices(choose, orm),
    refusals: choose('refusals', REFUSAL_FORMS, 'classes'),
    routes: choose('routes', ROUTE_FORMS, 'functions'),
    representations: choose('representations', REPRESENTATION_MODES, 'json'),
    forms: choose('forms', FORM_MODES, 'off'),
    schemas: choose('schemas', SCHEMA_FORMS, 'per-route'),
    valueObjects: choose('valueObjects', VALUE_OBJECT_FORMS, 'result'),
    literals: choose('literals', LITERAL_FORMS, 'free'),
    values: choose('values', VALUE_FORMS, 'free'),
    packageManager: choose('packageManager', PACKAGE_MANAGERS, 'npm'),
    tenancy: choose('tenancy', TENANCY_STRATEGIES, 'none'),
    queue: choose('queue', QUEUE_STORES, 'memory'),
  };
}

type Choices = Pick<
  Stack,
  | 'authn'
  | 'authz'
  | 'broker'
  | 'cache'
  | 'httpCache'
  | 'rpc'
  | 'storage'
  | 'audit'
  | 'eventSourcing'
  | 'privacy'
  | 'errors'
  | 'logger'
  | 'style'
  | 'assembly'
  | 'dependencies'
>;

function parseChoices(choose: Choose, orm: Stack['orm']): Choices {
  return {
    authn: choose('authn', AUTHN_STACKS, 'jwt'),
    authz: choose('authz', AUTHZ_STACKS, 'rbac'),
    broker: choose('broker', BROKER_STACKS, 'none'),
    cache: choose('cache', CACHE_STACKS, 'none'),
    httpCache: choose('httpCache', HTTP_CACHE_STACKS, 'none'),
    rpc: choose('rpc', RPC_STACKS, 'none'),
    storage: choose('storage', STORAGE_STACKS, 'none'),
    audit: choose('audit', AUDIT_MODES, orm === 'none' ? 'off' : 'on'),
    // Both were written before their choice existed: such a config has no event store and no privacy folder.
    eventSourcing: choose('eventSourcing', EVENT_SOURCING_MODES, 'off'),
    privacy: choose('privacy', PRIVACY_MODES, 'off'),
    errors: choose('errors', ERROR_REPORTERS, 'none'),
    logger: choose('logger', LOGGERS, 'stdout'),
    style: choose('style', STYLES, 'explicit'),
    assembly: choose('assembly', ASSEMBLIES, 'barrel'),
    dependencies: choose('dependencies', DEPENDENCY_STATEMENTS, 'listed'),
  };
}

interface Setting<T> {
  readonly fallback: T;
  readonly key: string;
}

function pick<T extends string>(values: readonly T[], value: unknown, setting: Setting<T>): T {
  if (value === undefined) {
    return setting.fallback;
  }

  if (isOneOf(values, value)) {
    return value;
  }

  throw new CliError(
    `${CONFIG_FILE}: "${setting.key}" is ${JSON.stringify(value)}.`,
    `Set "${setting.key}" to one of: ${values.join(', ')}.`,
  );
}
