import type { Config } from '../config';
import { DERIVED_FILES } from '../derived/derived-files';
import type { DerivedTree } from '../derived/derived-tree';
import { modulesByContext } from '../model-modules';
import type { GeneratedFileKind } from './generated-file-kind';

/**
 * The files a reviewer does not review, since a command of the kit writes them from the sources:
 * what the `## Do not report` of REVIEW.md names, and what `digest` lists apart as regenerated.
 * Read from `DERIVED_FILES`, the list the merge and the staging of a slice read too.
 */
export function generatedFiles(config: Config): readonly GeneratedFileKind[] {
  const tree: DerivedTree = {
    contextsDir: config.contextsDir,
    modules: modulesByContext(config),
    platformDir: config.platformDir,
  };

  return DERIVED_FILES.map((kind) => ({
    label: kind.label(tree),
    covers: (file: string) => kind.covers(file, tree),
    ...(kind.sections === undefined ? {} : { sections: kind.sections }),
  }));
}
