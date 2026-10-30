import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_PROFILES,
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
  HTTP_CACHE_STACKS,
  RPC_STACKS,
  HTTP_STACKS,
  IMPORT_EXTENSIONS,
  LOGGERS,
  FORM_MODES,
  REFUSAL_FORMS,
  REPRESENTATION_MODES,
  ROUTE_FORMS,
  SCHEMA_FORMS,
  PACKAGE_MANAGERS,
  STORAGE_STACKS,
  parseConfig,
  readConfig,
  TEST_STACKS,
  VALIDATION_STACKS,
  VALUE_OBJECT_FORMS,
  LITERAL_FORMS,
  VALUE_FORMS,
  type Config,
} from '../../config';
import { aliasProblem } from '../../alias';
import { DEFAULT_PACKAGE_MANAGER } from '../../package-manager/default-package-manager';
import { CliError } from '../../cli-error';
import { choose } from './choose';
import { recordedOptions } from './recorded-options';
import { resolveCiExtras } from './resolve-ci-extras';
import { resolvePersistence } from './resolve-persistence';
import { resolvePersonalData } from './resolve-personal-data';
import { resolveQueue } from './resolve-queue';
import { resolveStyle } from './resolve-style';
import { resolveTenancy } from './resolve-tenancy';
import type { StackOptions } from './stack-options';
import { httpCacheMisfit } from './http-cache-misfit';

export type { StackOptions } from './stack-options';

/**
 * The config of the project. Already initialised, it is the one on disk: `init` run again keeps
 * it, and `init --force` changes in it the choices its flags name and nothing else, so the
 * contexts, the rules and every other key a team declared survive. A new project gets the stack
 * the flags ask for.
 */
export function resolveStack(root: string, options: StackOptions): Config {
  const recorded = recordedConfig(root, options.force);

  if (recorded !== undefined && !options.force) {
    return supportedAlias({ ...recorded, agents: agentsOf(options, recorded) });
  }

  const asked = recorded === undefined ? options : { ...recordedOptions(recorded), ...options };
  const fresh = parseConfig({ ...spelling(asked, recorded), stack: stackOf(asked), contexts: {}, rules: {} });
  const { importAlias, importExtension } = fresh;
  // No flag and nothing to ask again: the config publishes its events in a way `init` does not offer, written by hand.
  const events = recorded !== undefined && asked.events === undefined ? recorded.stack.events : fresh.stack.events;
  const stack = { ...fresh.stack, events };
  const ci = { extras: resolveCiExtras(options.ciExtras, recorded, stack.ci) };
  const config = supportedAlias({ ...(recorded ?? fresh), importAlias, importExtension, stack, ci });

  return {
    ...config,
    worker: config.worker || hasWorker(root, config),
    sdk: sdkOf(options, config),
    agents: agentsOf(options, config),
  };
}

/** `--agent-profile` sets the profile of the agents or removes it (`none`), with or without `--force`; without the flag the config keeps its own. */
function agentsOf(options: StackOptions, config: Config): Config['agents'] {
  const asked = choose(AGENT_PROFILES, options.agentProfile, 'agent-profile');

  if (asked === undefined) {
    return config.agents;
  }

  return { profile: asked === 'none' ? undefined : asked };
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
  const tooling = resolveTooling(options, http);
  const writing = resolveWriting(options, { http, validation: tooling.validation });

  assertNestRoutes(writing.routes, http, tooling.validation);

  return {
    http,
    di,
    ...tooling,
    ...persistence,
    docsUi,
    ...resolveSecurity(options),
    broker,
    httpCache: resolveHttpCache(options, http, persistence.events),
    rpc: resolveRpc(options, http),
    ...resolveOperations(options, persistence.orm),
    ...resolvePersonalData(options, persistence.orm),
    ...writing,
    ...resolveStyle(options, di),
    ...resolvePresentation(options, http),
    tenancy: resolveTenancy(options, persistence.orm),
    queue: resolveQueue(options, persistence.orm),
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
 * The cache stays in the process unless asked otherwise; files are kept in a local directory
 * unless an object store is asked for; the audit trail is on as soon as there
 * is a database to keep it in; unexpected failures are reported nowhere unless asked; the logger
 * writes JSON lines on the standard output unless pino or winston is asked for. Error
 * reporting hangs on the buses, the HTTP boundary, the jobs and the process, which every stack
 * has: no other choice refuses it.
 */
function resolveOperations(
  options: StackOptions,
  orm: string,
): Record<'cache' | 'storage' | 'audit' | 'errors' | 'logger', string> {
  return {
    cache: choose(CACHE_STACKS, options.cache, 'cache') ?? 'none',
    // A new project keeps the content of its files in a directory while it is developed, in memory in its tests; a recorded one says what it chose, or none.
    storage: choose(STORAGE_STACKS, options.storage, 'storage') ?? 'local',
    audit: choose(AUDIT_MODES, options.audit, 'audit') ?? (orm === 'none' ? 'off' : 'on'),
    errors: choose(ERROR_REPORTERS, options.errors, 'errors') ?? 'none',
    logger: choose(LOGGERS, options.logger, 'logger') ?? 'stdout',
  };
}

/** How the code is written: a new project takes the forms of the current version, a recorded one keeps the form it says. */
function resolveWriting(
  options: StackOptions,
  { http, validation }: { http: string; validation: string },
): Record<'refusals' | 'routes' | 'schemas' | 'valueObjects' | 'literals' | 'values', string> {
  return {
    // A new project names each refusal and builds it through factories; a recorded one keeps the form it says, or the one of 0.2.
    refusals: choose(REFUSAL_FORMS, options.refusals, 'refusals') ?? 'named',
    // A new project writes each route as a controller class, a Nest controller on Nest with class-validator; a recorded one keeps the form it says, or the functions of 0.3.
    routes:
      choose(ROUTE_FORMS, options.routes, 'routes') ??
      (http === 'nest' && validation === 'class-validator' ? 'nest' : 'controllers'),
    // A new project declares a shape once and shares it; a recorded one keeps the form it says, or one schema per route as 0.5.
    schemas: choose(SCHEMA_FORMS, options.schemas, 'schemas') ?? 'shared',
    // A new project throws the refusals of its value objects; a recorded one keeps the form it says, or the Result of 0.5.
    valueObjects: choose(VALUE_OBJECT_FORMS, options.valueObjects, 'value-objects') ?? 'throwing',
    // A new project names its closed values and its numbers; a recorded one keeps the form it says, or the free literals of 0.5.
    literals: choose(LITERAL_FORMS, options.literals, 'literals') ?? 'named',
    // A new project writes its values as value object classes; a recorded one keeps the form it says, or the free form of 0.15.
    values: choose(VALUE_FORMS, options.values, 'values') ?? 'classes',
  };
}

/**
 * A new project with an HTTP stack negotiates its representations and serves the forms its routes
 * declare; one without HTTP has neither, and a recorded one keeps what it says, or JSON alone and
 * no form when it says nothing.
 */
function resolvePresentation(options: StackOptions, http: string): Record<'representations' | 'forms', string> {
  const representations = choose(REPRESENTATION_MODES, options.representations, 'representations');
  const forms = choose(FORM_MODES, options.forms, 'forms');

  return {
    representations: representations ?? (http === 'none' ? 'json' : 'negotiated'),
    forms: forms ?? (http === 'none' ? 'off' : 'on'),
  };
}

/** A shared cache purged after the commit needs an API to put it in front of, and the outbox its purge requests ride on. */
function resolveHttpCache(options: StackOptions, http: string, events: string): string {
  const httpCache = choose(HTTP_CACHE_STACKS, options.httpCache, 'http-cache') ?? 'none';

  if (httpCache === 'none' || (http !== 'none' && events === 'outbox')) {
    return httpCache;
  }

  throw new CliError(
    `--http-cache ${httpCache} ${httpCacheMisfit(options, http, events)}.`,
    'The purge of the shared cache is a row of the outbox, written with the command and sent after its commit: keep an HTTP framework and --events outbox, or --http-cache none.',
  );
}

/** Nest controllers are read through the DTO classes of class-validator, in a project that runs on Nest. */
function assertNestRoutes(routes: string, http: string, validation: string): void {
  if (routes !== 'nest' || (http === 'nest' && validation === 'class-validator')) {
    return;
  }

  throw new CliError(
    `--routes nest writes Nest controllers, and this project has --http ${http} and --validation ${validation}.`,
    'Choose --http nest --validation class-validator, or --routes controllers.',
  );
}

/** The procedures are the routes of the HTTP framework served a second way: there must be one. */
function resolveRpc(options: StackOptions, http: string): string {
  const rpc = choose(RPC_STACKS, options.rpc, 'rpc') ?? 'none';

  if (rpc === 'none' || http !== 'none') {
    return rpc;
  }

  throw new CliError(
    `--rpc ${rpc} cannot be combined with --http none.`,
    'The procedures run the routes of the contexts through the same pipeline: choose an HTTP framework, or --rpc none.',
  );
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

/** A Nest project validates with class-validator, as Nest does; any other with Zod. */
function resolveTooling(options: StackOptions, http: string): Tooling {
  return {
    validation:
      choose(VALIDATION_STACKS, options.validation, 'validation') ?? (http === 'nest' ? 'class-validator' : 'zod'),
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
    'NestJS hosts the application as a whole: use --http nest together with --di nest, or pick express, fastify or hono with tsyringe or manual.',
  );
}
