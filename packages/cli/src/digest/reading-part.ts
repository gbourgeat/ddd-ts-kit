import type { Config } from '../config';
import { ownEntry } from '../config/values/own-entry';
import type { ReadingPart } from './digest';

/** The folders of a context, in a module of its model too, and the part each is read in. */
const LAYERS: Readonly<Record<string, ReadingPart>> = {
  domain: 'domain',
  application: 'application',
  presentation: 'presentation',
  // What the context shows other contexts is read with what it shows clients.
  'published-language': 'presentation',
  infrastructure: 'infrastructure',
  test: 'tests',
};

/** What the storage of the project is: read with the infrastructure. */
const STORAGE = /^(?:migrations|prisma|drizzle)\//;
const SPEC = /\.(?:spec|test)\.[cm]?[jt]sx?$/;

/**
 * Where a file is read in a review, the order of the parts being that of `ReadingPart`: a file at
 * the root of a context (its CONTEXT.md, its permissions, its codes) with the context, a file of a
 * layer with its layer, the shared kernel with the domain, the migrations with the infrastructure,
 * a spec with the tests, the rest (the platform, the documents, the config) last.
 */
export function readingPart(config: Config, file: string): ReadingPart {
  if (file.startsWith(`${config.contextsDir}/`)) {
    return partInContext(file.slice(config.contextsDir.length + 1).split('/'));
  }

  if (SPEC.test(file) || file.startsWith('test/')) {
    return 'tests';
  }

  if (file.startsWith(`${config.sharedKernelDir}/`)) {
    return 'domain';
  }

  return STORAGE.test(file) ? 'infrastructure' : 'elsewhere';
}

/** `[context, ...]`: the first folder that names a layer, else the context itself. */
function partInContext([, ...inside]: readonly string[]): ReadingPart {
  return (
    inside
      .slice(0, -1)
      .map((folder) => ownEntry(LAYERS, folder))
      .find((part) => part !== undefined) ?? 'context'
  );
}
