import type { Config } from '../../config/index.js';

/** The directory of the shared kernel where the presentation types several contexts answer with live. */
export function sharedPresentation(config: Config): string {
  return `${config.sharedKernelDir}/presentation/`;
}
