import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { FLAT_FILES } from './flat-files.js';

/** The directories of the platform that hold folders only, once the files the kit writes are in them. */
const TIDIED = ['', 'auth'];

/** The files left in a directory of the platform that holds folders only, which the kit did not write: the team knows their folder. */
export function unknownFlatFiles(ws: Workspace, config: Config): string[] {
  return TIDIED.flatMap((directory) => {
    const prefix = directory === '' ? '' : `${directory}/`;

    return ws
      .list(directory === '' ? config.platformDir : `${config.platformDir}/${directory}`)
      .map((name) => `${prefix}${name}`)
      .filter((file) => !FLAT_FILES.has(file));
  });
}
