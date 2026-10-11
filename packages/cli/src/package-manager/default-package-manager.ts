import type { Stack } from '../config/index.js';

/**
 * What `init` chooses when `--package-manager` is left out: the fastest of the three on a
 * pipeline, measured on the default stack and on a heavy one (docs/tools/pipeline-performance.md),
 * among those the end-to-end suite of the CLI proves on a real install.
 */
export const DEFAULT_PACKAGE_MANAGER: Stack['packageManager'] = 'pnpm';
