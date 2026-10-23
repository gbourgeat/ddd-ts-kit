import type { Config } from '../config';
import { CliError } from '../cli-error';
import { generateContext } from '../generate/kinds/generate-context';
import type { Workspace } from '../workspace';

/** One `--context <name>:<classification>` of `init`: the same as `generate context` right after it. */
export function addContext(ws: Workspace, config: Config, entry: string): Config {
  const [name = '', classification] = entry.split(':');

  if (classification === undefined) {
    throw new CliError(
      `--context ${entry} has no classification.`,
      'Write it as <name>:<core|supporting|generic>, for example --context billing:core.',
    );
  }

  return generateContext(ws, config, { name, classification, upstreams: [] });
}
