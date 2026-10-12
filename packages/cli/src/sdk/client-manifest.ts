import { isRecord } from '../config/values/is-record.js';
import { manifestJson } from './manifest-json.js';

/** What the package.json of a client is made of. */
export interface ManifestFacts {
  readonly name: string;
  readonly version: string;
  readonly title: string;
  readonly access: string | undefined;
}

/**
 * The package.json of a client: the keys the generator owns (name, entry points, files, build,
 * access) written over the one on disk, every other key kept, the version included, which the
 * team raises before it publishes.
 */
export function clientManifest(facts: ManifestFacts, written: string | undefined): string {
  const existing = parsed(written);
  const owned = ownedKeys(facts);
  const kept = Object.entries(existing).filter(([key]) => !(key in owned) && key !== 'publishConfig');
  const publishConfig = { ...(isRecord(existing['publishConfig']) ? existing['publishConfig'] : {}) };

  delete publishConfig['access'];

  const access = facts.access === undefined ? {} : { access: facts.access };
  const merged = { ...publishConfig, ...access };

  return manifestJson({
    name: owned.name,
    version: typeof existing['version'] === 'string' ? existing['version'] : facts.version,
    ...owned,
    ...Object.fromEntries(kept),
    ...(Object.keys(merged).length === 0 ? {} : { publishConfig: merged }),
  });
}

function ownedKeys(facts: ManifestFacts): Record<string, unknown> {
  return {
    name: facts.name,
    description: `Typed client of ${facts.title}, generated from its OpenAPI contract by ddd-ts-kit.`,
    type: 'module',
    sideEffects: false,
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
    types: './dist/index.d.ts',
    files: ['dist', 'README.md'],
    scripts: { build: 'tsc -p tsconfig.json', prepublishOnly: 'npm run build' },
  };
}

function parsed(written: string | undefined): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(written ?? '{}');

    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}
