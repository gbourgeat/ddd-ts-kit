import { CliError } from '../cli-error';
import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { FLAT_FILES } from './flat-files';
import { PLATFORM_FOLDER_NAMES } from './platform-folder-names';

/**
 * The folder of each file of the team, from `--place <file>=<folder>`, both by their path from the
 * platform: a file the kit did not write, and a folder the kit gives files or one the platform has.
 */
export function placements(values: readonly string[], ws: Workspace, config: Config): Map<string, string> {
  return new Map(values.map((value) => placement(value, ws, config)));
}

function placement(value: string, ws: Workspace, config: Config): [string, string] {
  const [file = '', folder = '', ...rest] = value.split('=');
  const folders = [...PLATFORM_FOLDER_NAMES, ...ws.directories(config.platformDir)];

  if (rest.length > 0 || file === '' || !folders.includes(folder)) {
    throw new CliError(
      `--place ${value} names no folder of the platform.`,
      `Write --place <file>=<folder>, both from ${config.platformDir}/ and the folder one of ${[...new Set(folders)].join(', ')}: --place auth/role-grants.ts=auth/roles.`,
    );
  }

  if (FLAT_FILES.has(file)) {
    throw new CliError(
      `--place ${value} names a file the kit writes, which has its folder already.`,
      'Leave it out: the command takes it to its folder on its own.',
    );
  }

  if (!ws.exists(`${config.platformDir}/${file}`)) {
    throw new CliError(
      `--place ${value} names ${config.platformDir}/${file}, which does not exist.`,
      `Name the file by its path from ${config.platformDir}/, as the command listed it.`,
    );
  }

  return [file, folder];
}
