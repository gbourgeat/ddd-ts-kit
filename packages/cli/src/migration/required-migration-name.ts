import { CliError } from '../cli-error';
import { migrationName } from './migration-name';

/** What `--name` says a migration does: required, and fit for a file name. */
export function requiredMigrationName(given: string | undefined): string {
  const name = given?.trim() ?? '';

  if (name === '') {
    throw new CliError(
      'A migration is named by what it does.',
      'Run `npm run db:generate <what-it-does>`, for example `npm run db:generate add-invoices`.',
    );
  }

  return migrationName(name, 'Name it by what it does, in kebab-case: `npm run db:generate add-invoices`.');
}
