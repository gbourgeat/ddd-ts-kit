import { CONFIG_FILE, parseConfig } from '../config';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file';
import { renderCruiseFile } from '../depcruise/render-cruise-file';
import { CONTEXT_MAP } from '../docs/context-map-file';
import { writeDocs } from '../docs/write-docs';
import { ignoreCodeTypesWhereTheyAre } from '../knip';
import type { Workspace } from '../workspace';
import { type EarlierDeclarations, refreshBarrels } from './refresh-barrels';

/** Keeps what is derived from the config and the tree in step with what was just scaffolded, once the project has it. */
export function refreshDocs(ws: Workspace, earlier: EarlierDeclarations): void {
  const config = ws.read(CONFIG_FILE);

  if (config === undefined) {
    return;
  }

  const current = parseConfig(JSON.parse(config));

  refreshBarrels(ws, current, earlier);

  if (ws.exists(CONTEXT_MAP)) {
    writeDocs(ws, current, earlier);
  }

  // The import graph rules are derived from the config: a new context or upstream changes them.
  if (ws.exists(DEPCRUISE_FILE)) {
    ws.update(DEPCRUISE_FILE, renderCruiseFile(current));
  }

  // A code list written at the root of a context, or moved there, is one knip is told of.
  ignoreCodeTypesWhereTheyAre(ws, current);
}
