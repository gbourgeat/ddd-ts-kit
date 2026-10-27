import path from 'node:path';
import type { Config } from '../config';

/** The folders of a context that the shared kernel does not have: what a kind writes in one sits at its root. */
const FLATTENED = new Set(['domain', 'test']);

/**
 * Where a file of the shared kernel is, named by a kind as it would be in a context: the shared
 * kernel is flat, so `domain/value-objects/money.vo.ts` and `test/unit/money.vo.spec.ts` sit at
 * its root, the spec beside its subject. `presentation/` keeps its folder, and a file already at
 * the path asked stays there.
 */
export function sharedKernelPlacement(config: Config, existsAsIs: (file: string) => boolean): (file: string) => string {
  const prefix = `${config.sharedKernelDir}/`;

  return (file) => {
    if (!file.startsWith(prefix) || existsAsIs(file)) {
      return file;
    }

    const parts = file.slice(prefix.length).split('/');

    return FLATTENED.has(parts[0] ?? '') && parts.length > 2 ? `${prefix}${path.posix.basename(file)}` : file;
  };
}
