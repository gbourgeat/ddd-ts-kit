import type { Finding } from '../model/finding';
import type { ResolvedImport } from '../model/resolved-import';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inContext } from '../support/in-context';
import { perFile } from '../support/per-file';

const OPENSEARCH = '@ddd-ts-kit/opensearch';

/** What an adapter of a context may name: the store it extends, and the refusals it may catch. */
const ADAPTER_NAMES = [
  'OpenSearchReadModelStore',
  'InvalidIndexNameError',
  'OpenSearchRequestError',
  'OpenSearchUnavailableError',
  'UnprovisionedIndexError',
  'UnsupportedRebuildError',
];

/** What only the platform sets on a store: a key of these names in an adapter overrides the decision of the platform. */
const PLATFORM_KEYS = /\b(tenancy|strategy|transport)\b/g;

/** The layers that see a read model through its port only. */
const PORT_LAYERS = ['domain', 'application'];

const PORT_FIX =
  'Declare the port as an abstract class over `ReadModelStore<Row>` of @ddd-ts-kit/kernel in application/ports/; the adapter in infrastructure/ extends `OpenSearchReadModelStore`.';

const ADAPTER_FIX =
  'Extend `OpenSearchReadModelStore` and pass it `search.options(name, definition)`, `search` being the `SearchIndexes` of the platform (`init --search opensearch`), which sets the node and the tenancy of the project.';

export const searchStoreFromPlatform: Rule = {
  id: 'search/store-from-platform',
  description:
    'A context builds a store of @ddd-ts-kit/opensearch from the `SearchIndexes` of the platform only: it never opens a transport nor names a tenancy of its own, not even over the answer of `search.options`, and its domain/ and application/ name the `ReadModelStore` port, never the store.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      judged(file) ? [...file.imports.flatMap((imported) => findingsOf(imported, file)), ...overrides(file)] : [],
    );
  },
};

/** The production code of a context; the platform builds the transport and the tests may build a store on a node of their own. */
function judged(file: SourceFile): boolean {
  return inContext(file.location) && !file.isTest;
}

/** A tenancy, a strategy or a transport written in the code of an adapter, which the answer of `search.options` already holds. */
function overrides(file: SourceFile): Finding[] {
  if (!file.imports.some(({ target }) => target.kind === 'package' && target.name === OPENSEARCH)) {
    return [];
  }

  return [...file.scan.code.matchAll(PLATFORM_KEYS)].map((match) => ({
    line: file.scan.lineAt(match.index),
    message: `${match[0]} in an adapter of ${OPENSEARCH}: the transport and the tenancy of a store are the decision of the platform.`,
    fix: ADAPTER_FIX,
  }));
}

function findingsOf({ target, names, line }: ResolvedImport, file: SourceFile): Finding[] {
  if (target.kind !== 'package' || target.name !== OPENSEARCH) {
    return [];
  }

  const layer = inContext(file.location) ? file.location.layer : '';

  if (PORT_LAYERS.includes(layer)) {
    return [
      { line, message: `${layer}/ imports ${OPENSEARCH}: it sees a read model through its port.`, fix: PORT_FIX },
    ];
  }

  return names
    .filter((name) => !ADAPTER_NAMES.includes(name))
    .map((name) => ({
      line,
      message: `${name} of ${OPENSEARCH} in a context: the transport and the tenancy of a store are the decision of the platform.`,
      fix: ADAPTER_FIX,
    }));
}
