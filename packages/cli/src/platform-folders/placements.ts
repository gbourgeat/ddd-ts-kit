import { CliError } from '../cli-error.js';
import { AUTH_FOLDERS } from '../platform-auth/index.js';
import { KNOWN_AUTH_FILES } from './known-auth-files.js';

const FOLDERS: readonly string[] = Object.keys(AUTH_FOLDERS);

/** The folder of each file of the team, from `--place <file>=<folder>`: a file of `auth/` the kit did not write, a folder of `auth/`. */
export function placements(values: readonly string[]): Map<string, string> {
  return new Map(values.map(placement));
}

function placement(value: string): [string, string] {
  const [name = '', folder = '', ...rest] = value.split('=');

  if (rest.length > 0 || name === '' || !FOLDERS.includes(folder)) {
    throw new CliError(
      `--place ${value} names no folder of auth.`,
      `Write --place <file>=<folder>, the file as it is in auth/ and the folder one of ${FOLDERS.join(', ')}: --place role-grants.ts=roles.`,
    );
  }

  if (KNOWN_AUTH_FILES.includes(name)) {
    throw new CliError(
      `--place ${value} names a file the kit writes, which has its folder already.`,
      'Leave it out: the command takes it to its folder on its own.',
    );
  }

  return [name, folder];
}
