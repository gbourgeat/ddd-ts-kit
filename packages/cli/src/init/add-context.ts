import type { Config } from '../config/index.js';
import { CliError } from '../cli-error.js';
import { generateContext } from '../generate/kinds/generate-context.js';
import type { Workspace } from '../workspace/index.js';

/** One `--context <name>:<classification>` of `init`: the same as `generate context` right after it. */
export function addContext(ws: Workspace, config: Config, entry: string): Config {
  const [name = '', classification] = entry.split(':');

  if (classification === undefined) {
    throw new CliError(`--context ${entry} has no classification.`, 'Write it as <name>:<core|supporting|generic>, for example --context billing:core.');
  }

  return generateContext(ws, config, { name, classification, upstreams: [] });
}
