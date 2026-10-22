import path from 'node:path';
import { PLATFORM_LAYOUT } from '../platform-layout';

/** The folders of the platform the kit gives a file, by their path from the platform. */
export const PLATFORM_FOLDER_NAMES: readonly string[] = [
  ...new Set(PLATFORM_LAYOUT.flatMap(({ files }) => Object.values(files).map((file) => path.posix.dirname(file)))),
];
