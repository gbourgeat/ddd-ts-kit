import type { Config } from '../config';
import { generatedFiles } from './generated-files';

/** The generated files as the `## Do not report` of REVIEW.md names them, in one sentence. */
export function generatedFilesNamed(config: Config): string {
  return generatedFiles(config)
    .map((kind) => kind.label)
    .join(', ');
}
