import type { Config } from '../config';
import { dependenciesFile, isDeclarationsFile } from '../declared';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file';
import { declaredModules } from '../model-modules';
import { CONTEXT_MAP } from '../docs/context-map-file';
import { openApiDocumentsFile } from '../docs/open-api-documents-file';
import { WORKER_SCOPE_FILE } from './worker-scope-file';

/** The contracts in YAML or JSON (`openapi/<document>`, the AsyncAPI document) and the event catalog. */
const GENERATED_DOCUMENT =
  /^(?:openapi\/[^/]+|docs\/integration\/asyncapi)\.(?:ya?ml|json)$|^docs\/integration\/event-catalog\.md$/;

const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
const DERIVED_FILES = [...LOCKFILES, DEPCRUISE_FILE, CONTEXT_MAP, WORKER_SCOPE_FILE];

/** True for a file a command rewrites: counted in no commit size, merged by regenerating. */
export function isDerived(config: Config, file: string): boolean {
  if (DERIVED_FILES.includes(file) || GENERATED_DOCUMENT.test(file) || file === openApiDocumentsFile(config)) {
    return true;
  }

  const [context, ...inside] = file.startsWith(`${config.contextsDir}/`)
    ? file.slice(config.contextsDir.length + 1).split('/')
    : [];

  if (context === undefined) {
    return false;
  }

  return (
    isDeclarationsFile(context, inside.join('/'), declaredModules(config, context)) ||
    inside.join('/') === dependenciesFile(context)
  );
}
