import { isRecord } from '../config/values/is-record';
import { VERSIONS } from '../init/manifest/versions';
import { manifestJson } from './manifest-json';
import type { Rpc } from './rpc';
import { RPC_PACKAGES } from './rpc-packages';

/** What the package.json of a client is made of. */
export interface ManifestFacts {
  readonly name: string;
  readonly version: string;
  readonly title: string;
  readonly access: string | undefined;
  /** `orpc` or `trpc`: the client exports the procedures too, at `./orpc` or `./trpc`, with what it imports. */
  readonly rpc?: Rpc;
}

/**
 * The package.json of a client: the keys the generator owns (name, entry points, files, build,
 * access) written over the one on disk, every other key kept, the version included, which the
 * team raises before it publishes.
 */
export function clientManifest(facts: ManifestFacts, written: string | undefined): string {
  const existing = parsed(written);
  const owned = ownedKeys(facts);

  const kept = Object.entries(existing).filter(
    ([key]) => !(key in owned) && key !== 'publishConfig' && key !== 'dependencies',
  );

  const dependencies = dependenciesOf(existing['dependencies'], facts.rpc);
  const publishConfig = { ...(isRecord(existing['publishConfig']) ? existing['publishConfig'] : {}) };

  delete publishConfig['access'];

  const access = facts.access === undefined ? {} : { access: facts.access };
  const merged = { ...publishConfig, ...access };

  return manifestJson({
    name: owned.name,
    version: typeof existing['version'] === 'string' ? existing['version'] : facts.version,
    ...owned,
    ...Object.fromEntries(kept),
    ...(Object.keys(dependencies).length === 0 ? {} : { dependencies }),
    ...(Object.keys(merged).length === 0 ? {} : { publishConfig: merged }),
  });
}

function ownedKeys(facts: ManifestFacts): Record<string, unknown> {
  const { rpc = 'none' } = facts;

  const procedures =
    rpc === 'none' ? {} : { [`./${rpc}`]: { types: `./dist/${rpc}.d.ts`, default: `./dist/${rpc}.js` } };

  return {
    name: facts.name,
    description: `Typed client of ${facts.title}, generated from its OpenAPI contract by ddd-ts-kit.`,
    type: 'module',
    sideEffects: false,
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' }, ...procedures },
    types: './dist/index.d.ts',
    files: ['dist', 'README.md'],
    scripts: { build: 'tsc -p tsconfig.json', prepublishOnly: 'npm run build' },
  };
}

/** The dependencies the team added, and those of the procedures when the client has them: never those of an entry it no longer has. */
function dependenciesOf(written: unknown, rpc: Rpc = 'none'): Record<string, unknown> {
  const generated = new Set(Object.values(RPC_PACKAGES).flat());
  const own = Object.entries(isRecord(written) ? written : {}).filter(([name]) => !generated.has(name));
  const procedures = rpc === 'none' ? [] : RPC_PACKAGES[rpc].map((name) => [name, VERSIONS[name]] as const);

  return Object.fromEntries([...own, ...procedures].sort(([a], [b]) => a.localeCompare(b)));
}

function parsed(written: string | undefined): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(written ?? '{}');

    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}
