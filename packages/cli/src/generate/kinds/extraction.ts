import { CONFIG_FILE, editConfigText } from '../../config.js';
import { renderTemplate } from '../../templates.js';
import type { Kind } from '../kind.js';
import { barrelFile, routesFile } from '../../declared/roles.js';
import { hostImports, hostedContext } from '../access.js';
import { isDeclared } from '../declared.js';
import { openScope, relativeTo, vars, type Scope } from '../scope.js';

export const serviceKind: Kind = {
  name: 'service',
  aliases: [],
  usage: 'service <context>',
  summary: 'The context run alone: its entry point under apps/, a start script, a compose service, and `deployable` in the config.',
  positionals: ['context'],
  run: (request) => {
    const scope = openScope(request);
    const { ws, config, context } = scope;
    const entry = `${config.sourceRoot}/apps/${context.kebab}/main.ts`;
    const service = { ...selectionOf(scope), portVariable: `{${context.constant}_PORT:-3001}` };
    ws.create(entry, renderTemplate('service/main.ts.tpl', vars(scope, { service })));
    editJson(scope, 'package.json', (manifest) => addScript(manifest, `start:${context.kebab}`, `node dist/${entry.replace(/\.ts$/, '.js')}`));
    editJson(scope, 'knip.json', (knip) => addEntry(knip, `${config.sourceRoot}/apps/*/main.ts`));
    editJson(scope, CONFIG_FILE, (raw) => markDeployable(raw, context.kebab));
    addComposeService(scope, renderTemplate('service/compose.tpl', vars(scope, { service })));
    ws.note(`Build the image of the service with \`docker build --build-arg ENTRY=dist/${entry.replace(/\.ts$/, '.js')} .\`, or start it with \`docker compose --profile services up ${context.kebab}\`.`);
  },
};

/** What the entry point hands to `composeApplication` so that it hosts this context only, and what it imports for it. */
function selectionOf(scope: Scope): { selection: string; imports: string } {
  const { context, config } = scope;
  if (isDeclared(config)) return declaredSelection(scope);
  const module = `${toSource(scope)}/contexts/${context.kebab}/${context.kebab}.module.js`;
  const from = (names: string): string => `import { ${names} } from '${module}';`;
  if (config.stack.di !== 'tsyringe') return { selection: `[wire${context.pascal}]`, imports: from(`wire${context.pascal}`) };
  if (config.stack.http === 'none') return { selection: `{ modules: [${context.camel}Module] }`, imports: from(`${context.camel}Module`) };
  return { selection: `{ modules: [${context.camel}Module], routes: [${context.constant}_ROUTES] }`, imports: from(`${context.constant}_ROUTES, ${context.camel}Module`) };
}

const toSource = (scope: Scope): string => relativeTo(`${scope.config.sourceRoot}/apps/${scope.context.kebab}`, scope.config.sourceRoot);

/** The same line as in the composition root of the whole application, for this context alone. */
function declaredSelection(scope: Scope): { selection: string; imports: string } {
  const { context, config } = scope;
  const directory = `${relativeTo(`${config.sourceRoot}/apps/${context.kebab}`, config.contextsDir)}/${context.kebab}`;
  const withRoutes = config.stack.http !== 'none';
  const imports = [
    ...(config.stack.assembly === 'discovery' ? ["import { discoverContext } from '@ddd-ts-kit/di/discovery';"] : [`import * as ${context.camel}Declarations from '${directory}/${barrelFile(context.kebab).replace(/\.ts$/, '.js')}';`]),
    ...hostImports(config, relativeTo(`${config.sourceRoot}/apps/${context.kebab}`, config.platformDir)),
    ...(withRoutes ? [`import { ${context.camel}Routes } from '${directory}/${routesFile(context.kebab).replace(/\.ts$/, '.js')}';`] : []),
  ];
  const publishers = undiscoveredPublishers(scope, directory);
  const modules = [hostedContext(scope, `${directory}/`), ...publishers.modules];
  return { selection: `{ modules: [${modules.join(', ')}]${withRoutes ? `, routes: [${context.camel}Routes]` : ''} }`, imports: [...imports, ...publishers.imports].join('\n') };
}

/** `discoverContext` loads no `*.publisher` file: the entry point lists the publishers the context has today. */
function undiscoveredPublishers(scope: Scope, directory: string): { modules: string[]; imports: string[] } {
  const { ws, config, context, dir } = scope;
  const folder = 'application/integration/publishers';
  const found = config.stack.assembly !== 'discovery' ? [] : ws.list(`${dir}/${folder}`).flatMap((file) => {
    const name = /export class (\w+)/.exec(ws.read(`${dir}/${folder}/${file}`) ?? '')?.[1];
    return name === undefined ? [] : [{ name, file }];
  });
  if (found.length === 0) return { modules: [], imports: [] };
  ws.note(`The publishers of ${context.kebab} are listed in the entry point, since discovery does not load them: add the ones generated later to its \`contextModule('${context.kebab}.publishers', [...])\`.`);
  return {
    modules: [`contextModule('${context.kebab}.publishers', [${found.map(({ name }) => name).join(', ')}])`],
    imports: ["import { contextModule } from '@ddd-ts-kit/di';", ...found.map(({ name, file }) => `import { ${name} } from '${directory}/${folder}/${file.replace(/\.ts$/, '.js')}';`)],
  };
}

type Json = Record<string, unknown>;

function editJson(scope: Scope, file: string, edit: (raw: Json) => void): void {
  const text = scope.ws.read(file);
  if (text === undefined) scope.ws.note(`${file} does not exist: nothing was added to it.`);
  else scope.ws.update(file, editConfigText(text, edit));
}

function addScript(manifest: Json, name: string, command: string): void {
  manifest['scripts'] = { ...recordOf(manifest['scripts']), [name]: command };
}

function addEntry(knip: Json, pattern: string): void {
  const entries: unknown[] = Array.isArray(knip['entry']) ? knip['entry'] : [];
  if (!entries.includes(pattern)) knip['entry'] = [...entries, pattern];
}

function markDeployable(raw: Json, context: string): void {
  const contexts = recordOf(raw['contexts']);
  raw['contexts'] = { ...contexts, [context]: { ...recordOf(contexts[context]), deployable: true } };
}

function recordOf(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
}

const COMPOSE = 'docker-compose.yml';

/** The services end where the top-level `volumes:` key begins, or with the file. */
function addComposeService(scope: Scope, service: string): void {
  const compose = scope.ws.read(COMPOSE);
  const name = `\n  ${scope.context.kebab}:\n`;
  if (compose === undefined || compose.includes(name)) return;
  const volumes = compose.indexOf('\nvolumes:');
  const head = (volumes === -1 ? compose : compose.slice(0, volumes)).trimEnd();
  const tail = volumes === -1 ? '\n' : `\n${compose.slice(volumes)}`;
  scope.ws.update(COMPOSE, `${head}\n${service.trimEnd()}\n${tail}`);
}
