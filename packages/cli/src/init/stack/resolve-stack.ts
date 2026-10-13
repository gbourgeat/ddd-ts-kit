import fs from 'node:fs';
import path from 'node:path';
import {
  AUDIT_MODES,
  AUTHN_STACKS,
  AUTHZ_STACKS,
  BROKER_STACKS,
  CACHE_STACKS,
  CI_PLATFORMS,
  CONFIG_FILE,
  DEFAULT_IMPORT_ALIAS,
  DEFAULT_IMPORT_EXTENSION,
  DEFAULT_SDK_NAME,
  DI_STACKS,
  DOCS_UIS,
  ERROR_REPORTERS,
  HTTP_STACKS,
  IMPORT_EXTENSIONS,
  LOGGERS,
  REFUSAL_FORMS,
  ROUTE_FORMS,
  PACKAGE_MANAGERS,
  parseConfig,
  readConfig,
  TEST_STACKS,
  VALIDATION_STACKS,
  type Config,
} from '../../config/index.js';
import { aliasProblem } from '../../alias/index.js';
import { DEFAULT_PACKAGE_MANAGER } from '../../package-manager/default-package-manager.js';
import { CliError } from '../../cli-error.js';
import { choose } from './choose.js';
import { recordedOptions } from './recorded-options.js';
import { resolveCiExtras } from './resolve-ci-extras.js';
import { resolvePersistence } from './resolve-persistence.js';
import { resolveStyle } from './resolve-style.js';
import type { StackOptions } from './stack-options.js';

export type { StackOptions } from './stack-options.js';

/**
 * The config of the project. Already initialised, it is the one on disk: `init` run again keeps
 * it, and `init --force` changes in it the choices its flags name and nothing else, so the
 * contexts, the rules and every other key a team declared survive. A new project gets the stack
 * the flags ask for.
 */
export function resolveStack(root: string, options: StackOptions): Config {
  const recorded = recordedConfig(root, options.force);

  if (recorded !== undefined && !options.force) {
    return supportedAlias(recorded);
  }

  const asked = recorded === undefined ? options : { ...recordedOptions(recorded), ...options };
  const fresh = parseConfig({ ...spelling(asked, recorded), stack: stackOf(asked), contexts: {}, rules: {} });
  const { importAlias, importExtension } = fresh;
  // No flag and nothing to ask again: the config publishes its events in a way `init` does not offer, written by hand.
  const events = recorded !== undefined && asked.events === undefined ? recorded.stack.events : fresh.stack.events;
  const stack = { ...fresh.stack, events };
  const ci = { extras: resolveCiExtras(options.ciExtras, recorded, stack.ci) };
  const config = supportedAlias({ ...(recorded ?? fresh), importAlias, importExtension, stack, ci });

  return { ...config, worker: config.worker || hasWorker(root, config), sdk: sdkOf(options, config) };
}

/** `--sdk` records the clients with their default name; a config that has them keeps its own. */
function sdkOf(options: StackOptions, config: Config): Config['sdk'] {
  if (options.sdk !== true || config.sdk !== undefined) {
    return config.sdk;
  }

  if (config.stack.http === 'none') {
    throw new CliError(
      '--sdk cannot be combined with --http none.',
      'A client is generated from the OpenAPI contract of the HTTP boundary: pick an HTTP framework, or leave --sdk out.',
    );
  }

  return { name: DEFAULT_SDK_NAME, access: undefined };
}

/** Nothing for a new project, and for a config `--force` is about to replace because it cannot be read. */
function recordedConfig(root: string, force: boolean): Config | undefined {
  if (!fs.existsSync(path.join(root, CONFIG_FILE))) {
    return undefined;
  }

  try {
    return readConfig(root).config;
  } catch (error) {
    if (force) {
      return undefined;
    }

    throw error;
  }
}

/** How the imports are written: what a flag asks, else what the project already does, else the defaults of a new project. */
function spelling(options: StackOptions, recorded: Config | undefined): Record<string, string> {
  const extension = choose(IMPORT_EXTENSIONS, options.importExtension, 'import-extension');

  return {
    importAlias: options.importAlias ?? recorded?.importAlias ?? DEFAULT_IMPORT_ALIAS,
    importExtension: extension ?? recorded?.importExtension ?? DEFAULT_IMPORT_EXTENSION,
  };
}

function stackOf(options: StackOptions): Record<string, string> {
  const http = choose(HTTP_STACKS, options.http, 'http') ?? 'express';
  const di = choose(DI_STACKS, options.di, 'di') ?? (http === 'nest' ? 'nest' : 'tsyringe');

  assertNestGoesWithNest(http, di);

  const docsUi = http === 'none' ? 'none' : (choose(DOCS_UIS, options.docsUi, 'docs-ui') ?? 'swagger');
  const persistence = resolvePersistence(options);
  const broker = resolveBroker(options, persistence.orm);

  return {
    http,
    di,
    ...resolveTooling(options),
    ...persistence,
    docsUi,
    ...resolveSecurity(options),
    broker,
    ...resolveOperations(options, persistence.orm),
    ...resolveStyle(options, di),
  };
}

/** Every file `init` writes imports by the alias: one that some tool cannot resolve is refused before anything is written. */
function supportedAlias(config: Config): Config {
  const problem = aliasProblem(config.importAlias);

  if (problem === undefined) {
    return config;
  }

  throw new CliError(
    `The import alias "${config.importAlias}" is not supported: ${problem}.`,
    `Use "${DEFAULT_IMPORT_ALIAS}" or "$<name>/" (--import-alias, or "importAlias" in ${CONFIG_FILE}).`,
  );
}

/** A worker that is already there keeps the jobs, so the API still starts with its jobs off, whatever the config says of it. */
function hasWorker(root: string, config: Config): boolean {
  return fs.existsSync(path.join(root, config.sourceRoot, 'apps/worker/main.ts'));
}

/**
 * The cache stays in the process unless asked otherwise; the audit trail is on as soon as there
 * is a database to keep it in; unexpected failures are reported nowhere unless asked; the logger
 * writes JSON lines on the standard output unless pino or winston is asked for. Error
 * reporting hangs on the buses, the HTTP boundary, the jobs and the process, which every stack
 * has: no other choice refuses it.
 */
function resolveOperations(
  options: StackOptions,
  orm: string,
): Record<'cache' | 'audit' | 'errors' | 'logger' | 'refusals' | 'routes', string> {
  return {
    cache: choose(CACHE_STACKS, options.cache, 'cache') ?? 'none',
    audit: choose(AUDIT_MODES, options.audit, 'audit') ?? (orm === 'none' ? 'off' : 'on'),
    errors: choose(ERROR_REPORTERS, options.errors, 'errors') ?? 'none',
    logger: choose(LOGGERS, options.logger, 'logger') ?? 'stdout',
    // A new project builds its domain errors through factories; a recorded one keeps the form it says, or the one of 0.2.
    refusals: choose(REFUSAL_FORMS, options.refusals, 'refusals') ?? 'factories',
    // A new project writes each route as a controller class; a recorded one keeps the form it says, or the functions of 0.3.
    routes: choose(ROUTE_FORMS, options.routes, 'routes') ?? 'controllers',
  };
}

function resolveSecurity(options: StackOptions): { authn: string; authz: string } {
  return {
    authn: choose(AUTHN_STACKS, options.authn, 'authn') ?? 'jwt',
    authz: choose(AUTHZ_STACKS, options.authz, 'authz') ?? 'rbac',
  };
}

function resolveBroker(options: StackOptions, orm: string): string {
  const broker = choose(BROKER_STACKS, options.broker, 'broker') ?? 'none';

  if (broker === 'none' || orm !== 'none') {
    return broker;
  }

  throw new CliError(
    `--broker ${broker} cannot be combined with --orm none.`,
    'A broker is reached through the transactional outbox, which needs a database: pick an ORM, or keep --broker none.',
  );
}

type Tooling = Record<'validation' | 'tests' | 'ci' | 'packageManager', string>;

function resolveTooling(options: StackOptions): Tooling {
  return {
    validation: choose(VALIDATION_STACKS, options.validation, 'validation') ?? 'zod',
    tests: choose(TEST_STACKS, options.tests, 'tests') ?? 'vitest',
    ci: choose(CI_PLATFORMS, options.ci, 'ci') ?? 'github',
    packageManager: choose(PACKAGE_MANAGERS, options.packageManager, 'package-manager') ?? DEFAULT_PACKAGE_MANAGER,
  };
}

function assertNestGoesWithNest(http: string, di: string): void {
  if ((http === 'nest') === (di === 'nest')) {
    return;
  }

  throw new CliError(
    `--http ${http} cannot be combined with --di ${di}.`,
    'NestJS hosts the application as a whole: use --http nest together with --di nest, or pick express or fastify with tsyringe or manual.',
  );
}
