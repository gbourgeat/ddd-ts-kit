import { escapeRegExp } from '../check/text/escape-reg-exp';
import { filesUnder } from '../generate/files-under';
import type { Workspace } from '../workspace';
import type { FileMove } from './file-move';

/** Where the migrations of a project live, whatever writes them. */
const MIGRATIONS = 'migrations';
const SOURCE = /\.(?:[cm]?[jt]s)$/;
const EXTENSION = /\.(?:ts|tsx|mts)$/;

/**
 * The migrations follow a moved file too. A migration is run under plain node, which resolves no
 * alias: it names the compiled file by its path (`../dist/src/contexts/billing/infrastructure/persistence/add-notes.schema.js`),
 * which no import of the sources reads. Each specifier that ends with the path of a moved file
 * names its new path, whatever stands before it. Answers the migrations rewritten.
 */
export function followInMigrations(ws: Workspace, moved: readonly FileMove[]): string[] {
  const renamed = moved.map(({ from, to }) => ({
    from: new RegExp(`(['"][^'"\\n]*/)${escapeRegExp(from.replace(EXTENSION, ''))}((?:\\.[cm]?js)?['"])`, 'g'),
    to: to.replace(EXTENSION, ''),
  }));

  return filesUnder(ws, MIGRATIONS)
    .filter((file) => SOURCE.test(file))
    .map((file) => `${MIGRATIONS}/${file}`)
    .filter((file) => {
      const source = ws.read(file) ?? '';
      const next = renamed.reduce((text, { from, to }) => text.replace(from, `$1${to}$2`), source);

      if (next !== source) {
        ws.writeAsIs(file, next);
      }

      return next !== source;
    });
}
