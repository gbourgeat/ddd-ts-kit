import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { one } from './one.js';

/** Where the content of files lives, and whether the routes that receive and serve them exist. */
export function filesVars(config: Config): RenderContext {
  const { storage, http } = config.stack;

  return {
    ...one(storage, ['none', 'local', 's3']),
    any: storage !== 'none',
    http: storage !== 'none' && http !== 'none',
  };
}
