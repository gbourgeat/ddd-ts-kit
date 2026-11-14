import type { FileReader } from '../generate/kinds/same-name/sources-of';
import { gitProcess } from './git-process';
import type { MergeContext } from './merge-context';

/** Reads a file of the project in a commit or a tree of the repository. */
export function trunkReader({ top, prefix }: MergeContext['repo'], commit: string): FileReader {
  return (file) => {
    const shown = gitProcess(top, ['show', `${commit}:${prefix}${file}`]);

    return shown.status === 0 ? shown.stdout : undefined;
  };
}
