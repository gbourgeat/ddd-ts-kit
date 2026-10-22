import { PLATFORM_LAYOUT } from '../platform-layout';

/** Every file the kit wrote flat before the folders, by its path from the platform, with the path it has now. */
export const FLAT_FILES: ReadonlyMap<string, string> = new Map(
  PLATFORM_LAYOUT.flatMap(({ files }) => Object.entries(files)),
);
