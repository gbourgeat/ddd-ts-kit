import type { Config } from '../config';
import { dependenciesFile, isDeclarationsFile } from '../declared';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file';
import { CONTEXT_MAP } from '../docs/context-map-file';
import { openApiDocumentsFile } from '../docs/open-api-documents-file';
import { declaredModules } from '../model-modules';
import type { GeneratedFileKind } from './generated-file-kind';

/** The contracts in YAML or JSON (`docs/integration/asyncapi`) and the event catalog. */
const INTEGRATION_DOCUMENTS = /^docs\/integration\/(?:asyncapi\.(?:ya?ml|json)|event-catalog\.md)$/;

/**
 * The files a reviewer does not review, since a command of the kit writes them from the sources:
 * what the `## Do not report` of REVIEW.md names, and what `digest` lists apart as regenerated.
 * One list, so that the policy of the project and the digest of a branch cannot disagree.
 */
export function generatedFiles(config: Config): readonly GeneratedFileKind[] {
  const documents = openApiDocumentsFile(config);
  const schemaIndex = `${config.platformDir}/database/schema.ts`;

  return [
    {
      label: 'the barrels (the declarations of each context and of its layers)',
      covers: (file) => isContextDeclarations(config, file),
    },
    { label: '`openapi/`', covers: (file) => file.startsWith('openapi/') },
    { label: 'the clients of `clients/`', covers: (file) => file.startsWith('clients/') },
    {
      label: '`docs/integration/asyncapi.yaml` and `docs/integration/event-catalog.md`',
      covers: (file) => INTEGRATION_DOCUMENTS.test(file),
    },
    { label: 'the behaviour pages of `docs/behaviour/`', covers: (file) => file.startsWith('docs/behaviour/') },
    { label: `\`${CONTEXT_MAP}\``, covers: (file) => file === CONTEXT_MAP },
    { label: `\`${documents}\``, covers: (file) => file === documents },
    { label: `the schema index \`${schemaIndex}\``, covers: (file) => file === schemaIndex },
    { label: `\`${DEPCRUISE_FILE}\``, covers: (file) => file === DEPCRUISE_FILE },
    {
      label: 'the generated sections of each `CONTEXT.md`',
      covers: (file) => isContextDoc(config, file),
      sections: true,
    },
  ];
}

/** `<context>.declarations.ts`, `<layer>/<layer>.declarations.ts` and `<context>.dependencies.ts`, in a module too. */
function isContextDeclarations(config: Config, file: string): boolean {
  const [context, inside] = splitContext(config, file);

  return (
    context !== undefined &&
    (isDeclarationsFile(context, inside, declaredModules(config, context)) || inside === dependenciesFile(context))
  );
}

function isContextDoc(config: Config, file: string): boolean {
  const [context, inside] = splitContext(config, file);

  return context !== undefined && inside === 'CONTEXT.md';
}

/** The context a path is in, and the path inside it; no context outside the contexts directory. */
function splitContext(config: Config, file: string): readonly [string | undefined, string] {
  if (!file.startsWith(`${config.contextsDir}/`)) {
    return [undefined, file];
  }

  const [context, ...inside] = file.slice(config.contextsDir.length + 1).split('/');

  return inside.length === 0 ? [undefined, file] : [context, inside.join('/')];
}
