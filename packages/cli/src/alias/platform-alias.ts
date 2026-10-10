import type { Config } from '../config/index.js';
import { aliasRoots } from './alias-roots.js';
import { directoryAlias } from './directory-alias.js';

/** The alias of the platform directory, without a final slash. */
export function platformAlias(config: Config): string {
  return directoryAlias(aliasRoots(config), config.platformDir);
}
