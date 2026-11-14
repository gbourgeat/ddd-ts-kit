import type { Config } from '../../../config';
import { heldFileOf, treeOf } from '../../../model-modules';
import type { Workspace } from '../../../workspace';

/** The tables file of a context on Drizzle and on TypeORM, from the project root, where the context holds it. */
export function tablesFileOf(ws: Workspace, config: Config, context: string): string {
  return heldFileOf(ws, treeOf(config, context), `infrastructure/persistence/${context}.schema.ts`);
}
