import type { Workspace } from '../workspace';
import { type ContextTree, roleFilesOf } from '../model-modules';

const FOLDER = 'domain/vocabularies';
const DECLARED = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^}]*)\}\s*as\s+const/g;
const ENTRY = /([A-Za-z_$][\w$]*|'[^']*')\s*:\s*'([^']*)'/g;

/** The closed vocabularies of a context, `domain/vocabularies/*.vocabulary.ts`: by name, each member and its value. */
export function readVocabularies(ws: Workspace, tree: ContextTree): Map<string, Map<string, string>> {
  const vocabularies = new Map<string, Map<string, string>>();

  for (const file of roleFilesOf(ws, tree, FOLDER).filter(({ name }) => name.endsWith('.vocabulary.ts'))) {
    for (const [, name = '', body = ''] of (ws.read(file.path) ?? '').matchAll(DECLARED)) {
      vocabularies.set(
        name,
        new Map([...body.matchAll(ENTRY)].map(([, key = '', value = '']) => [key.replaceAll("'", ''), value])),
      );
    }
  }

  return vocabularies;
}
