import type { Config } from '../config/index.js';

/** A move, by its context and the path of the file it leaves from the contexts directory, without extension. */
interface Leaving {
  readonly context: string;
  readonly path: string;
}

/**
 * Two contexts may name a class the same way: a move concerns the files of its own context, and
 * elsewhere the files that import the class from that context.
 */
export function concerns(move: Leaving, { file, source }: { file: string; source: string }, config: Config): boolean {
  const contexts = `${config.contextsDir}/`;

  return file.startsWith(contexts) ? file.startsWith(`${contexts}${move.context}/`) : source.includes(`/${move.path}`);
}
