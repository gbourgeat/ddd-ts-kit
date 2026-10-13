import fs from 'node:fs';
import path from 'node:path';
import { createEventRegistry, generateEventCatalog, type AnyIntegrationEventDefinition } from '@ddd-ts-kit/events';
import { generateAsyncApi } from '@ddd-ts-kit/events/asyncapi';
import { contractFormat, stringifyContract } from 'ddd-ts-kit/dist/contracts.js';

// Generates docs/integration/asyncapi.yaml (asyncapi.json under "openapi.format": "json" in
// ddd-ts-kit.config.json) and docs/integration/event-catalog.md from the declarations of every
// published language; with --check, fails when a committed file differs. Both files are build
// products: never edit them by hand.
const contextsDirectory = '{{config.contextsDir}}';
const target = path.resolve('docs/integration');
const format = contractFormat();
const other = format === 'yaml' ? 'asyncapi.json' : 'asyncapi.yaml';

/** The type of each declaration by the name its published language exports it under, `invoiceIssuedV1`: what a handler reads with `invoiceIssuedV1.type`. */
const typesByName = new Map<string, string>();
const registry = createEventRegistry(await declaredEvents());

const generated: Readonly<Record<string, string>> = {
  [`asyncapi.${format}`]: stringifyContract(
    generateAsyncApi({
      info: {
        title: manifestField('name', '{{project.name}}'),
        version: manifestField('version', '0.0.0'),
      },
      registry,
    }),
    format,
  ),
  'event-catalog.md': generateEventCatalog(registry, { consumers: consumersByEventType() }),
};

if (process.argv.includes('--check')) {
  reportStale();
} else {
  fs.mkdirSync(target, { recursive: true });
  fs.rmSync(path.join(target, other), { force: true });

  for (const [file, content] of Object.entries(generated)) {
    fs.writeFileSync(path.join(target, file), content);
  }
}

function reportStale(): void {
  for (const [file, content] of Object.entries(generated)) {
    const committed = fs.existsSync(path.join(target, file)) ? fs.readFileSync(path.join(target, file), 'utf8') : '';

    if (committed.replaceAll('\r\n', '\n') !== content) {
      console.error('docs/integration/' + file + ' is out of date: run the script `docs:generate` and commit it.');
      process.exitCode = 1;
    }
  }

  if (fs.existsSync(path.join(target, other))) {
    console.error('docs/integration/' + other + ' is in the other format: run the script `docs:generate`.');
    process.exitCode = 1;
  }
}

/** Every declaration exported by a published language. Read from the compiled modules next to this script, so that a new context needs no registration: a path completed at run time cannot be an import alias, which the build rewrites. */
async function declaredEvents(): Promise<AnyIntegrationEventDefinition[]> {
  const declarations: AnyIntegrationEventDefinition[] = [];

  for (const context of contextNames()) {
    const index = new URL('../{{config.contextsDir}}/' + context + '/published-language/index.js', import.meta.url);
    const exported: unknown = await import(index.href);

    const entries: [string, unknown][] =
      typeof exported === 'object' && exported !== null ? Object.entries(exported) : [];

    for (const [name, value] of entries) {
      if (isDeclaration(value)) {
        declarations.push(value);
        typesByName.set(name, value.type);
      }
    }
  }

  return declarations;
}

function contextNames(): string[] {
  if (!fs.existsSync(path.resolve(contextsDirectory))) {
    return [];
  }

  return fs
    .readdirSync(path.resolve(contextsDirectory), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && fs.existsSync(path.resolve(contextsDirectory, entry.name, 'published-language')),
    )
    .map((entry) => entry.name);
}

function isDeclaration(value: unknown): value is AnyIntegrationEventDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'version' in value &&
    'payload' in value &&
    'create' in value
  );
}

/** Who consumes what, read from the sources: an integration event handler names the type it handles in `eventType`, read from the declaration (`invoiceIssuedV1.type`) or written out. */
function consumersByEventType(): Record<string, string[]> {
  const consumers: Record<string, string[]> = {};

  for (const context of contextNames()) {
    for (const type of consumedBy(context)) {
      consumers[type] = [...new Set([...(consumers[type] ?? []), context])];
    }
  }

  return consumers;
}

function consumedBy(context: string): string[] {
  const directory = path.resolve(contextsDirectory, context, 'application/integration/handlers');
  const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];

  return files.flatMap((file) => {
    const written = /static readonly eventType = (?:'([^']+)'|([A-Za-z_$][\w$]*)\.type\b)/.exec(
      fs.readFileSync(path.join(directory, file), 'utf8'),
    );

    const type = written?.[1] ?? typesByName.get(written?.[2] ?? '');

    return type === undefined ? [] : [type];
  });
}

function manifestField(name: string, fallback: string): string {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

  if (typeof manifest !== 'object' || manifest === null) {
    return fallback;
  }

  const value: unknown = Reflect.get(manifest, name);

  return typeof value === 'string' ? value : fallback;
}
