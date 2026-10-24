import { type ContextTree, roleFilesOf } from '../model-modules';
import type { Workspace } from '../workspace';
import { personalDeclarationsIn } from './personal-declarations-in';
import type { PersonalTableFacts } from './personal-table-facts';

const FOLDER = 'infrastructure/persistence';
const SUFFIX = '.personal-fields.ts';

/**
 * The personal data a context keeps, one entry per `personalFields` call of its
 * `infrastructure/persistence/*.personal-fields.ts` files: the declaration `generate repository
 * --personal` writes, or one written by hand in that file. The table is read from the declaration
 * (`{ table: 'customers' }`) or from the persistence file that defines the table it names
 * (a Drizzle table, a TypeORM entity schema).
 */
export function readPersonalData(ws: Workspace, tree: ContextTree): PersonalTableFacts[] {
  const persistence = roleFilesOf(ws, tree, FOLDER).filter(({ name }) => name.endsWith('.ts'));
  const sources = persistence.map(({ path }) => ws.read(path) ?? '').join('\n');

  return persistence
    .filter(({ name }) => name.endsWith(SUFFIX))
    .flatMap(({ path }) =>
      personalDeclarationsIn(ws.read(path) ?? '', sources).map(({ offset: _offset, ...declared }) => ({
        file: path,
        ...declared,
      })),
    );
}
