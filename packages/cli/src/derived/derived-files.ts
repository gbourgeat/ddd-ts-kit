import { isDeclarationsFile } from '../declared';
import { BEHAVIOUR_PAGES } from './behaviour-pages';
import type { DerivedFileKind } from './derived-file-kind';
import type { DerivedTree } from './derived-tree';

/** The contracts in YAML or JSON (`docs/integration/asyncapi`) and the event catalog; the README beside them is written by people. */
const INTEGRATION_DOCUMENTS = /^docs\/integration\/(?:asyncapi\.(?:ya?ml|json)|event-catalog\.md)$/;

/**
 * Every kind of file a command of the kit writes from the sources, in the order the `## Do not
 * report` of REVIEW.md names them. One list: `isDerived` (the merge, the staging of a slice), the
 * pathspecs a merge compares patches without, the policy `init` writes and the files `digest`
 * lists apart all read it, so that a file added here reaches each of them.
 */
export const DERIVED_FILES: readonly DerivedFileKind[] = [
  {
    label: () => 'the barrels (the declarations of each context and of its layers)',
    covers: (path, tree) => isContextDeclarations(path, tree),
    pathspecs: ({ contextsDir }) => [
      `${contextsDir}/*/*.declarations.ts`,
      `${contextsDir}/*/*/*.declarations.ts`,
      `${contextsDir}/*/*/*/*.declarations.ts`,
      `${contextsDir}/*/*.dependencies.ts`,
    ],
    regenerated: true,
  },
  whole('`openapi/`', (path) => path.startsWith('openapi/'), ['openapi/**']),
  whole('the clients of `clients/`', (path) => path.startsWith('clients/'), ['clients/**']),
  whole(
    '`docs/integration/asyncapi.yaml` and `docs/integration/event-catalog.md`',
    (path) => INTEGRATION_DOCUMENTS.test(path),
    ['docs/integration/asyncapi.*', 'docs/integration/event-catalog.md'],
  ),
  {
    label: () => `the behaviour pages of \`${BEHAVIOUR_PAGES}\``,
    covers: (path) => path.startsWith(BEHAVIOUR_PAGES),
    pathspecs: () => [`${BEHAVIOUR_PAGES}**`],
    regenerated: false,
  },
  whole('`docs/context-map.md`', (path) => path === 'docs/context-map.md', ['docs/context-map.md']),
  {
    label: ({ platformDir = '<platformDir>' }) => `\`${platformDir}/http/openapi-documents.ts\``,
    covers: (path, { platformDir }) => platformDir !== undefined && path === `${platformDir}/http/openapi-documents.ts`,
    pathspecs: ({ platformDir }) => (platformDir === undefined ? [] : [`${platformDir}/http/openapi-documents.ts`]),
    regenerated: true,
  },
  {
    label: ({ platformDir = '<platformDir>' }) => `the schema index \`${platformDir}/database/schema.ts\``,
    covers: (path, { platformDir }) => platformDir !== undefined && path === `${platformDir}/database/schema.ts`,
    pathspecs: ({ platformDir }) => (platformDir === undefined ? [] : [`${platformDir}/database/schema.ts`]),
    regenerated: false,
  },
  whole('`.dependency-cruiser.cjs`', (path) => path === '.dependency-cruiser.cjs', ['.dependency-cruiser.cjs']),
  {
    label: () => 'the generated sections of each `CONTEXT.md`',
    covers: (path, { contextsDir }) => {
      const [context, ...inside] = path.startsWith(`${contextsDir}/`)
        ? path.slice(contextsDir.length + 1).split('/')
        : [];

      return context !== undefined && inside.join('/') === 'CONTEXT.md';
    },
    pathspecs: ({ contextsDir }) => [`${contextsDir}/*/CONTEXT.md`],
    regenerated: true,
    sections: true,
  },
];

/** A kind written again whole by `npm run regenerate`, outside the platform. */
function whole(label: string, covers: (path: string) => boolean, pathspecs: readonly string[]): DerivedFileKind {
  return { label: () => label, covers, pathspecs: () => pathspecs, regenerated: true };
}

/** `<context>.declarations.ts`, `<layer>/<layer>.declarations.ts` and `<context>.dependencies.ts`, in a module too. */
function isContextDeclarations(path: string, { contextsDir, modules }: DerivedTree): boolean {
  const [context, ...inside] = path.startsWith(`${contextsDir}/`) ? path.slice(contextsDir.length + 1).split('/') : [];
  const file = inside.join('/');

  return (
    context !== undefined &&
    inside.length > 0 &&
    (file === `${context}.dependencies.ts` || isDeclarationsFile(context, file, modules[context] ?? []))
  );
}
