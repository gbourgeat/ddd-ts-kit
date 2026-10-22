import type { BuildLayout } from './build-layout';

/** What `init` writes in tsconfig.json. */
export const DEFAULT_BUILD_LAYOUT: BuildLayout = { rootDir: '.', outDir: 'dist' };
