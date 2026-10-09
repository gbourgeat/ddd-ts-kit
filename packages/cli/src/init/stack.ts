import fs from 'node:fs';
import path from 'node:path';
import {
  CI_PLATFORMS,
  CONFIG_FILE,
  DATABASE_STACKS,
  DI_STACKS,
  DOCS_UIS,
  HTTP_STACKS,
  isOneOf,
  ORM_STACKS,
  parseConfig,
  readConfig,
  TEST_STACKS,
  VALIDATION_STACKS,
  type Config,
} from '../config.js';
import { CliError } from '../errors.js';

const EVENT_CHOICES = ['in-memory', 'outbox'] as const;

export interface StackOptions {
  readonly http?: string;
  readonly validation?: string;
  readonly di?: string;
  readonly tests?: string;
  readonly orm?: string;
  readonly database?: string;
  readonly events?: string;
  readonly docsUi?: string;
  readonly ci?: string;
  readonly force: boolean;
}

/** The stack of the project: the one its config records when it is already initialised, else the one the flags ask for. */
export function resolveStack(root: string, options: StackOptions): Config {
  if (fs.existsSync(path.join(root, CONFIG_FILE)) && !options.force) {
    return readConfig(root).config;
  }
  const http = choose(HTTP_STACKS, options.http, 'http') ?? 'express';
  const di = choose(DI_STACKS, options.di, 'di') ?? (http === 'nest' ? 'nest' : 'tsyringe');
  assertNestGoesWithNest(http, di);
  const stack = { http, di, ...resolveTooling(options), ...resolvePersistence(options), docsUi: http === 'none' ? 'none' : (choose(DOCS_UIS, options.docsUi, 'docs-ui') ?? 'swagger') };
  return parseConfig({ stack, contexts: {}, rules: {} });
}

function resolveTooling(options: StackOptions): { validation: string; tests: string; ci: string } {
  return {
    validation: choose(VALIDATION_STACKS, options.validation, 'validation') ?? 'zod',
    tests: choose(TEST_STACKS, options.tests, 'tests') ?? 'vitest',
    ci: choose(CI_PLATFORMS, options.ci, 'ci') ?? 'github',
  };
}

function choose<T extends string>(values: readonly T[], value: string | undefined, flag: string): T | undefined {
  if (value === undefined) return undefined;
  if (isOneOf(values, value)) return value;
  throw new CliError(`Unknown value "${value}" for --${flag}.`, `Use one of: ${values.join(', ')}.`);
}

function assertNestGoesWithNest(http: string, di: string): void {
  if ((http === 'nest') === (di === 'nest')) return;
  throw new CliError(
    `--http ${http} cannot be combined with --di ${di}.`,
    'NestJS hosts the application as a whole: use --http nest together with --di nest, or pick express or fastify with tsyringe or manual.',
  );
}

/** The generated persistence is written for PostgreSQL, the dialect every adapter package tests. `custom` and `none` bring their own storage, or none. */
const WRITTEN_FOR_POSTGRES = ['drizzle', 'knex', 'prisma', 'typeorm'];

function resolvePersistence(options: StackOptions): { orm: string; database: string; events: string } {
  const requested = choose(DATABASE_STACKS, options.database, 'database');
  const orm = choose(ORM_STACKS, options.orm, 'orm') ?? (requested === 'none' ? 'none' : 'drizzle');
  const needsPostgres = WRITTEN_FOR_POSTGRES.includes(orm);
  const database = requested ?? (needsPostgres ? 'postgres' : 'none');
  if (needsPostgres && database !== 'postgres') {
    throw new CliError(
      `--orm ${orm} cannot be combined with --database ${database}.`,
      `With ${orm}, use --database postgres: the generated adapters are written for it. Pick --orm custom to bring your own for another database.`,
    );
  }
  const events = choose(EVENT_CHOICES, options.events, 'events') ?? (orm === 'none' ? 'in-memory' : 'outbox');
  return { orm, database, events };
}
