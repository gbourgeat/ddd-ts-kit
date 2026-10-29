import { CliError } from '../cli-error';

/**
 * The name of a migration, which the CLI of the ORM is given and writes in a file name: letters,
 * digits, dashes and underscores, starting with a letter or a digit. Anything else is refused
 * before the ORM sees it: a value that starts with a dash is read as one of its options, and a
 * slash or a dot as a path.
 */
export function migrationName(name: string, fix: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) {
    return name;
  }

  throw new CliError(
    `"${name}" cannot name a migration: a migration is named in letters, digits, dashes and underscores, starting with a letter or a digit.`,
    fix,
  );
}
