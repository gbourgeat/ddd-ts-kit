import type { Config } from '../config/index.js';
import { aliasRoots } from './alias-roots.js';
import { directoryAlias } from './directory-alias.js';

/** The alias of the directory of a bounded context, without a final slash. */
export function contextAlias(config: Config, context: string): string {
  return `${directoryAlias(aliasRoots(config), config.contextsDir)}/${context}`;
}
