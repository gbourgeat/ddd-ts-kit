import fs from 'node:fs';
import path from 'node:path';
import { createEventRegistry, generateEventCatalog, type AnyIntegrationEventDefinition } from '@ddd-ts-kit/events';
import { generateAsyncApi, stringifyAsyncApi } from '@ddd-ts-kit/events/asyncapi';

// Generates docs/integration/asyncapi.json and docs/integration/event-catalog.md from the
// declarations of every published language; with --check, fails when a committed file
// differs. Both files are build products: never edit them by hand.
const CONTEXTS = '{{config.contextsDir}}';
const TARGET = path.resolve('docs/integration');

const registry = createEventRegistry(await declaredEvents());
const generated: Readonly<Record<string, string>> = {
  'asyncapi.json': stringifyAsyncApi(generateAsyncApi({ info: { title: manifestField('name', '{{project.name}}'), version: manifestField('version', '0.0.0') }, registry })),
  'event-catalog.md': generateEventCatalog(registry, { consumers: consumersByEventType() }),
};

if (process.argv.includes('--check')) {
  reportStale();
} else {
  fs.mkdirSync(TARGET, { recursive: true });
  for (const [file, content] of Object.entries(generated)) {
    fs.writeFileSync(path.join(TARGET, file), content);
  }
}

function reportStale(): void {
  for (const [file, content] of Object.entries(generated)) {
    const committed = fs.existsSync(path.join(TARGET, file)) ? fs.readFileSync(path.join(TARGET, file), 'utf8') : '';
    if (committed.replaceAll('\r\n', '\n') !== content) {
      console.error('docs/integration/' + file + ' is out of date: run `npm run docs:generate` and commit the result.');
      process.exitCode = 1;
    }
  }
}

/** Every declaration exported by a published language. Read from the compiled modules next to this script, so that a new context needs no registration. */
async function declaredEvents(): Promise<AnyIntegrationEventDefinition[]> {
  const declarations: AnyIntegrationEventDefinition[] = [];
  for (const context of contextNames()) {
    const index = new URL('{{paths.scriptsToSource}}/contexts/' + context + '/published-language/index.js', import.meta.url);
    const exported: unknown = await import(index.href);
    const values: unknown[] = typeof exported === 'object' && exported !== null ? Object.values(exported) : [];
    declarations.push(...values.filter(isDeclaration));
  }
  return declarations;
}

function contextNames(): string[] {
  if (!fs.existsSync(path.resolve(CONTEXTS))) {
    return [];
  }
  return fs
    .readdirSync(path.resolve(CONTEXTS), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.resolve(CONTEXTS, entry.name, 'published-language')))
    .map((entry) => entry.name);
}

function isDeclaration(value: unknown): value is AnyIntegrationEventDefinition {
  return typeof value === 'object' && value !== null && 'type' in value && 'version' in value && 'payload' in value && 'create' in value;
}

/** Who consumes what, read from the sources: a consumer names the type it listens to in `eventType`. */
function consumersByEventType(): Record<string, string[]> {
  const consumers: Record<string, string[]> = {};
  for (const context of contextNames()) {
    const directory = path.resolve(CONTEXTS, context, 'application/integration/consumers');
    for (const file of fs.existsSync(directory) ? fs.readdirSync(directory) : []) {
      const type = /static readonly eventType = '([^']+)'/.exec(fs.readFileSync(path.join(directory, file), 'utf8'))?.[1];
      if (type !== undefined) {
        consumers[type] = [...new Set([...(consumers[type] ?? []), context])];
      }
    }
  }
  return consumers;
}

function manifestField(name: string, fallback: string): string {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null) {
    return fallback;
  }
  const value: unknown = Reflect.get(manifest, name);
  return typeof value === 'string' ? value : fallback;
}
