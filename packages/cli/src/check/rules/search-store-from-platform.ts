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

const STORE = 'OpenSearchReadModelStore';

/** The answer of `search.options` spread into an object of the context's own, which may then replace its tenancy or its transport. */
const SPREAD_OPTIONS = /\.\.\.\s*[\w$]+(?:\s*\.\s*[\w$]+)*\s*\.\s*options\s*\(/g;

/** The one argument a store may be built with: the options the platform answers, on a parameter of the constructor. */
const SUPER_FROM_PLATFORM = /^super\s*\(\s*[A-Za-z_$][\w$]*\s*\.\s*options\s*\(/;

const NAMED_ELSEWHERE = `${STORE} named outside \`extends ${STORE}<..>\`: a store is built from the options of the platform only.`;

/** The layers that see a read model through its port only. */
const PORT_LAYERS = ['domain', 'application'];

const PORT_FIX =
  'Declare the port as an abstract class over `ReadModelStore<Row>` of @ddd-ts-kit/kernel in application/ports/; the adapter in infrastructure/ extends `OpenSearchReadModelStore`.';

const ADAPTER_FIX =
  'Extend `OpenSearchReadModelStore` and pass it `search.options(name, definition)`, `search` being the `SearchIndexes` of the platform (`init --search opensearch`), which sets the node and the tenancy of the project.';

export const searchStoreFromPlatform: Rule = {
  id: 'search/store-from-platform',
  description:
    'A context builds a store of @ddd-ts-kit/opensearch from the `SearchIndexes` of the platform only: an adapter extends `OpenSearchReadModelStore` and calls `super(<search>.options(..))`; no file of a context spreads that answer, names the store anywhere else, opens a transport or names a tenancy, and its domain/ and application/ name the `ReadModelStore` port, never the store.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      judged(file) ? [...file.imports.flatMap((imported) => findingsOf(imported, file)), ...builtByHand(file)] : [],
    );
  },
};

/** The production code of a context; the platform builds the transport and the tests may build a store on a node of their own. */
function judged(file: SourceFile): boolean {
  return inContext(file.location) && !file.isTest;
}

/** What builds a store with options other than those of the platform, read from the text of the file. */
function builtByHand(file: SourceFile): Finding[] {
  const { code } = file.scan;

  const at = (index: number, message: string): Finding => ({
    line: file.scan.lineAt(index),
    message,
    fix: ADAPTER_FIX,
  });

  const spread = [...code.matchAll(SPREAD_OPTIONS)].map(({ index }) =>
    at(
      index,
      'the options of the platform spread into an object of a context: its tenancy or its transport may be replaced.',
    ),
  );

  if (!file.imports.some(({ target }) => target.kind === 'package' && target.name === OPENSEARCH)) {
    return spread;
  }

  return [...spread, ...storeNamedElsewhere(code).map((index) => at(index, NAMED_ELSEWHERE)), ...superOfHand(code, at)];
}

/** Each mention of the store outside its import and outside `extends OpenSearchReadModelStore<`. */
function storeNamedElsewhere(code: string): number[] {
  return [...code.matchAll(new RegExp(`\\b${STORE}\\b`, 'g'))]
    .map(({ index }) => index)
    .filter((index) => !inImport(code, index) && !isExtended(code, index));
}

/** In a class that extends the store, a constructor that passes it anything but `<parameter>.options(..)`, or none. */
function superOfHand(code: string, at: (index: number, message: string) => Finding): Finding[] {
  return [...code.matchAll(new RegExp(`\\bextends\\s+${STORE}\\s*<`, 'g'))].flatMap(({ index }) => {
    const next = code.slice(index + 1).search(/\bclass\b/);
    const body = next === -1 ? code.slice(index) : code.slice(index, index + 1 + next);
    const supers = [...body.matchAll(/\bsuper\s*\(/g)];

    if (supers.length === 0) {
      return [at(index, `a class that extends ${STORE} with no constructor: whoever builds it chooses its options.`)];
    }

    return supers
      .filter((call) => !SUPER_FROM_PLATFORM.test(body.slice(call.index)))
      .map((call) => at(index + call.index, `super(..) of ${STORE} given anything but \`<search>.options(..)\`.`));
  });
}

function inImport(code: string, index: number): boolean {
  return /\bimport\b[^;]*$/.test(code.slice(0, index));
}

function isExtended(code: string, index: number): boolean {
  return /\bextends\s+$/.test(code.slice(0, index)) && /^\w+\s*</.test(code.slice(index));
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
