import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../helpers';

/** An asset of the pipeline: `source` is the one of the repository, `template` the copy the CLI ships. */
export function pipelineAsset(kind: 'source' | 'template', file: string): string {
  const directory = kind === 'source' ? 'pipeline' : 'packages/cli/templates/pipeline';

  return fs.readFileSync(path.join(REPO_ROOT, directory, file), 'utf8');
}
