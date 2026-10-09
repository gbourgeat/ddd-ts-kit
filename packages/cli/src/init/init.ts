import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, serializeConfig, type Config } from '../config.js';
import { DEPCRUISE_FILE, renderCruiseFile } from '../depcruise/configuration.js';
import { writeDocs } from '../docs/docs.js';
import { CliError } from '../errors.js';
import { generateContext } from '../generate/kinds/context.js';
import { writeAdr } from '../generate/kinds/governance.js';
import { stackVars } from '../generate/scope.js';
import { toName } from '../naming.js';
import type { RenderContext } from '../render.js';
import { readTemplate, renderTemplate } from '../templates.js';
import { Workspace, type WorkspaceReport } from '../workspace.js';
import { initFiles } from './files.js';
import { writeManifest } from './manifest.js';
import { writeAgentSettings } from './agent-settings.js';
import { resolveStack, type StackOptions } from './stack.js';

export interface InitOptions extends StackOptions {
  /** `<name>:<classification>` entries. */
  readonly contexts: readonly string[];
  readonly dryRun: boolean;
}

export function runInit(root: string, options: InitOptions): WorkspaceReport {
  const ws = new Workspace(root, options.force);
  const config = recordingNoOutbox(ws, resolveStack(root, options), options);
  const projectName = existingName(root) ?? (toName(path.basename(path.resolve(root))).kebab || 'app');

  ws.create(CONFIG_FILE, serializeConfig(config));
  writeManifest(ws, { config, projectName, force: options.force });
  writeTypeScriptConfigs(ws, config);
  const context = templateVars(config, projectName);
  for (const [target, template] of initFiles(config)) {
    ws.create(target, template.endsWith('.tpl') ? renderTemplate(template, context) : readTemplate(template));
  }
  ws.create(DEPCRUISE_FILE, renderCruiseFile(config));
  writeAgentSettings(ws);
  ws.create(`${config.sharedKernelDir}/.gitkeep`, '');

  const withContexts = options.contexts.reduce((current, entry) => addContext(ws, current, entry), config);
  ws.update(DEPCRUISE_FILE, renderCruiseFile(withContexts));
  writeDocs(ws, withContexts);
  const report = ws.commit(options.dryRun);
  if (!options.dryRun && report.created.includes('package.json')) report.notes.push('Run `npm install`, then `npm run verify`.');
  return report;
}

/** `--allow-no-outbox`: the choice is kept, with the decision record and the config entry that make it a recorded deviation. */
function recordingNoOutbox(ws: Workspace, config: Config, options: InitOptions): Config {
  const reason = options.allowNoOutbox?.trim() ?? '';
  const { orm, events } = config.stack;
  if (reason === '' || orm === 'none' || events === 'outbox' || config.deviations.some((deviation) => deviation.what === 'stack.events')) return config;
  const adr = writeAdr(ws, { title: 'Publish integration events without the transactional outbox', deviation: { what: 'stack.events', reason } });
  return { ...config, deviations: [...config.deviations, { what: 'stack.events', adr, reason }] };
}

function existingName(root: string): string | undefined {
  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const name: unknown = typeof manifest === 'object' && manifest !== null ? Reflect.get(manifest, 'name') : undefined;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

function addContext(ws: Workspace, config: Config, entry: string): Config {
  const [name = '', classification] = entry.split(':');
  if (classification === undefined) {
    throw new CliError(`--context ${entry} has no classification.`, 'Write it as <name>:<core|supporting|generic>, for example --context billing:core.');
  }
  return generateContext(ws, config, { name, classification, upstreams: [] });
}

const WITH_URL = ['drizzle', 'knex', 'prisma', 'typeorm'];

function templateVars(config: Config, projectName: string): RenderContext {
  const { orm, database, docsUi, ci, authn, http, broker } = config.stack;
  const verifiesTokens = authn === 'jwt' && http !== 'none';
  return {
    ...stackVars(config),
    project: { name: projectName },
    docs: { any: docsUi !== 'none', ui: docsUi },
    knip: knipVars(config.stack.http !== 'none'),
    ci: { github: ci === 'github' || ci === 'both', gitlab: ci === 'gitlab' || ci === 'both', any: ci !== 'none' },
    needs: { url: WITH_URL.includes(orm) || verifiesTokens || broker === 'rabbitmq' },
    database: { postgres: database === 'postgres', mysql: database === 'mysql', sqlite: database === 'sqlite', server: database === 'postgres' || database === 'mysql' },
    paths: { databaseToGenerated: path.posix.relative(`${config.platformDir}/database`, 'generated'), scriptsToSource: `../${config.sourceRoot}`, e2eToPlatform: `../../../${config.platformDir}` },
  };
}

function writeTypeScriptConfigs(ws: Workspace, config: Config): void {
  const { http, validation, orm } = config.stack;
  const decorators = http === 'nest' || validation === 'class-validator';
  const compilerOptions = {
    target: 'ES2023',
    lib: ['ES2023'],
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
    ...(decorators ? { experimentalDecorators: true, emitDecoratorMetadata: true } : {}),
    types: ['node'],
    rootDir: '.',
    outDir: 'dist',
    paths: { [`${config.importAlias}*`]: [`./${config.sourceRoot}/*`] },
  };
  const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
  ws.create('tsconfig.json', json({ compilerOptions, include: [config.sourceRoot, 'scripts', 'test', ...(orm === 'prisma' ? ['generated'] : [])] }));
  ws.create('tsconfig.build.json', json({ extends: './tsconfig.json', exclude: ['test', '**/test/**', '**/*.spec.ts', '**/testing.ts'] }));
}

/** The end-to-end tree exists only with an HTTP stack: knip is told about it only then, so that no pattern matches nothing. */
function knipVars(hasEndToEnd: boolean): RenderContext {
  const when = (text: string): string => (hasEndToEnd ? text : '');
  return {
    e2eEntry: when(',\n    "test/e2e/**/*.ts"'),
    e2eProject: when(', "test/**/*.ts"'),
    e2eConfig: when(', "vitest.e2e.config.ts"'),
    e2eSpecs: when(', "test/e2e/**/*.e2e.spec.ts"'),
  };
}
