import { CliError } from '../cli-error.js';
import { CONFIG_FILE } from './config-file.js';
import { isOneOf } from './is-one-of.js';
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
  EVENT_STACKS,
  HTTP_STACKS,
  LOGGERS,
  ORM_STACKS,
  PACKAGE_MANAGERS,
  REFUSAL_FORMS,
  ROUTE_FORMS,
  STYLES,
  TENANCY_STRATEGIES,
  TEST_STACKS,
  VALIDATION_STACKS,
  type Stack,
} from './stack.js';

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
    packageManager: choose('packageManager', PACKAGE_MANAGERS, 'npm'),
    tenancy: choose('tenancy', TENANCY_STRATEGIES, 'none'),
  };
}

type Choices = Pick<
  Stack,
  'authn' | 'authz' | 'broker' | 'cache' | 'audit' | 'errors' | 'logger' | 'style' | 'assembly' | 'dependencies'
>;

function parseChoices(choose: Choose, orm: Stack['orm']): Choices {
  return {
    authn: choose('authn', AUTHN_STACKS, 'jwt'),
    authz: choose('authz', AUTHZ_STACKS, 'rbac'),
    broker: choose('broker', BROKER_STACKS, 'none'),
    cache: choose('cache', CACHE_STACKS, 'none'),
    audit: choose('audit', AUDIT_MODES, orm === 'none' ? 'off' : 'on'),
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
