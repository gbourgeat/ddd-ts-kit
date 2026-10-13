import type { SourceFile } from '../model/source-file.js';
import { executorUses } from './executor-uses.js';

/** Raw SQL, which no helper confines. */
const RAW = /\.raw\s*\(/g;

/** What a Knex adapter of tenant data reaches without the helpers: the executor called, chained or held, and raw SQL. */
export function knexUnscoped(file: SourceFile): readonly { offset: number; message: string }[] {
  const { code } = file.scan;

  const straight = executorUses(code)
    .filter((use) => !use.handedOver)
    .map((use) => ({
      offset: use.offset,
      message: 'The executor is used straight (called, chained or held): no tenant condition confines it.',
    }));

  const raw = [...code.matchAll(RAW)].map((match) => ({
    offset: match.index,
    message: 'Raw SQL reaches the tables with no tenant condition.',
  }));

  return [...straight, ...raw];
}
