import fs from 'node:fs';
import path from 'node:path';
import {
  AUTHN_STACKS,
  AUTHZ_STACKS,
  BROKER_STACKS,
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
  readonly authn?: string;
  readonly authz?: string;
  readonly broker?: string;
  /** The reason given for running an ORM without the transactional outbox. */
  readonly allowNoOutbox?: string;
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
  const docsUi = http === 'none' ? 'none' : (choose(DOCS_UIS, options.docsUi, 'docs-ui') ?? 'swagger');
  const persistence = resolvePersistence(options);
  const stack = { http, di, ...resolveTooling(options), ...persistence, docsUi, ...resolveSecurity(options), broker: resolveBroker(options, persistence.orm) };
  return parseConfig({ stack, contexts: {}, rules: {} });
}

function resolveSecurity(options: StackOptions): { authn: string; authz: string } {
  return { authn: choose(AUTHN_STACKS, options.authn, 'authn') ?? 'jwt', authz: choose(AUTHZ_STACKS, options.authz, 'authz') ?? 'rbac' };
}

function resolveBroker(options: StackOptions, orm: string): string {
  const broker = choose(BROKER_STACKS, options.broker, 'broker') ?? 'none';
  if (broker === 'none' || orm !== 'none') return broker;
  throw new CliError(
    `--broker ${broker} cannot be combined with --orm none.`,
    'A broker is reached through the transactional outbox, which needs a database: pick an ORM, or keep --broker none.',
  );
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
  assertOutboxWithDatabase({ orm, events }, options.allowNoOutbox);
  return { orm, database, events };
}

/** docs/ARCHITECTURE.md, `events/outbox-required`: leaving the outbox out with a database is a recorded deviation, never a default. */
function assertOutboxWithDatabase(stack: { orm: string; events: string }, reason: string | undefined): void {
  if (stack.orm === 'none' || stack.events === 'outbox' || (reason !== undefined && reason.trim() !== '')) return;
  throw new CliError(
    `--events ${stack.events} cannot be combined with --orm ${stack.orm}.`,
    'With a database, integration events leave through the transactional outbox, or a state change and its event can part ways. Drop --events, or record the decision with --allow-no-outbox "<reason>": it writes a deviation entry and an ADR stub.',
  );
}
