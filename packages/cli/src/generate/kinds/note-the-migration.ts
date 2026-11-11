import { WITH_DATABASE } from '../../stack/with-database';
import type { Scope } from '../scope';

/** The specs pass on the in-process database, which builds from the schema: nothing else says that a deployed one lacks the table. */
export function noteTheMigration(scope: Scope): void {
  const { orm } = scope.config.stack;

  if (!WITH_DATABASE.includes(orm)) {
    return;
  }

  const generate =
    orm === 'typeorm'
      ? 'npm run build && npm run db:generate migrations/<what-it-does>'
      : 'npm run db:generate <what-it-does>';

  scope.ws.note(
    `The table reaches no database until \`${generate}\` writes its migration and \`npm run db:migrate\` applies it: the specs pass before that, on the in-process database.`,
  );
}
