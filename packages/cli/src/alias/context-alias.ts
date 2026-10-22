import type { Config } from '../config';
import { aliasRoots } from './alias-roots';
import { directoryAlias } from './directory-alias';

/** The alias of the directory of a bounded context, without a final slash. */
export function contextAlias(config: Config, context: string): string {
  return `${directoryAlias(aliasRoots(config), config.contextsDir)}/${context}`;
}
