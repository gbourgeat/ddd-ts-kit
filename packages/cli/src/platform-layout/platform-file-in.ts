import type { Config } from '../config';
import { PLATFORM_LAYOUT } from './platform-layout';
import type { PlatformFile } from './platform-file';

/**
 * The path of a file of the platform in this project. A project generated before the folders
 * keeps the files of a group flat, its anchor among them: there, a file that is not in its folder
 * is read and written flat, until the team moves them.
 */
export function platformFileIn(config: Config, file: PlatformFile, exists: (path: string) => boolean): string {
  const placed = `${config.platformDir}/${file}`;
  const group = PLATFORM_LAYOUT.find(({ files }) => Object.values(files).some((path) => path === file));
  const flat = Object.entries(group?.files ?? {}).find(([, path]) => path === file)?.[0];

  if (exists(placed) || group === undefined || flat === undefined) {
    return placed;
  }

  return exists(`${config.platformDir}/${flat}`) || exists(`${config.platformDir}/${group.anchor}`)
    ? `${config.platformDir}/${flat}`
    : placed;
}
