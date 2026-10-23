import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { one } from './one';

/** Where the content of files lives, and whether the routes that receive and serve them exist. */
export function filesVars(config: Config): RenderContext {
  const { storage, http } = config.stack;

  return {
    ...one(storage, ['none', 'local', 's3']),
    any: storage !== 'none',
    http: storage !== 'none' && http !== 'none',
  };
}
