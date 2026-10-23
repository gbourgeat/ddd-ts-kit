import type { Config } from '../config';
import { PLATFORM_LAYOUT } from './platform-layout';
import type { PlatformFile } from './platform-file';

/** Both paths a file of the platform may have, in its folder and flat: a rule reads it at either. */
export function platformFilePaths(config: Config, file: PlatformFile): string[] {
  const flat = PLATFORM_LAYOUT.flatMap(({ files }) => Object.entries(files))
    .filter(([, placed]) => placed === file)
    .map(([path]) => `${config.platformDir}/${path}`);

  return [`${config.platformDir}/${file}`, ...flat];
}
