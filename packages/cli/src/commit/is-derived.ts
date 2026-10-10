import type { Config } from '../config/index.js';
import { barrelFile } from '../declared/index.js';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file.js';
import { CONTEXT_MAP } from '../docs/context-map-file.js';
import { WORKER_SCOPE_FILE } from './worker-scope-file.js';

const GENERATED_DOCUMENTS = [
  'openapi/openapi.json',
  'docs/integration/asyncapi.json',
  'docs/integration/event-catalog.md',
];

const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
const DERIVED_FILES = [...GENERATED_DOCUMENTS, ...LOCKFILES, DEPCRUISE_FILE, CONTEXT_MAP, WORKER_SCOPE_FILE];

/** True for a file a command rewrites: counted in no commit size, merged by regenerating. */
export function isDerived(config: Config, file: string): boolean {
  if (DERIVED_FILES.includes(file)) {
    return true;
  }

  const [context, name, ...deeper] = file.startsWith(`${config.contextsDir}/`)
    ? file.slice(config.contextsDir.length + 1).split('/')
    : [];

  return context !== undefined && deeper.length === 0 && name === barrelFile(context);
}
