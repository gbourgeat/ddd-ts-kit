import type { Config } from '../../../config/index.js';

/** Under `"stack.schemas": "shared"`, a command answers with the `Accepted` schema of the platform instead of one of its own. */
export function sharesSchemas(config: Config): boolean {
  return config.stack.schemas === 'shared';
}
