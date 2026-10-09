import { CONFIG_FILE, editConfigText } from '../../config.js';
import { renderTemplate } from '../../templates.js';
import type { Kind } from '../kind.js';
import { openScope, vars, type Scope } from '../scope.js';

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

/** What the entry point hands to `composeApplication` so that it hosts this context only. */
function selectionOf(scope: Scope): { selection: string; selectionImport: string } {
  const { context, config } = scope;
  if (config.stack.di !== 'tsyringe') return { selection: `[wire${context.pascal}]`, selectionImport: `wire${context.pascal}` };
  if (config.stack.http === 'none') return { selection: `{ modules: [${context.camel}Module] }`, selectionImport: `${context.camel}Module` };
  return {
    selection: `{ modules: [${context.camel}Module], routes: [${context.constant}_ROUTES] }`,
    selectionImport: `${context.constant}_ROUTES, ${context.camel}Module`,
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
