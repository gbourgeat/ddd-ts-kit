import { CONFIG_FILE, parseConfig } from '../config/index.js';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file.js';
import { renderCruiseFile } from '../depcruise/render-cruise-file.js';
import { CONTEXT_MAP } from '../docs/context-map-file.js';
import { writeDocs } from '../docs/write-docs.js';
import type { Workspace } from '../workspace/index.js';
import { refreshBarrels, type SingleFile } from './refresh-barrels.js';

/** Keeps what is derived from the config and the tree in step with what was just scaffolded, once the project has it. */
export function refreshDocs(ws: Workspace, singleFile: SingleFile): void {
  const config = ws.read(CONFIG_FILE);

  if (config === undefined) {
    return;
  }

  const current = parseConfig(JSON.parse(config));

  refreshBarrels(ws, current, singleFile);

  if (ws.exists(CONTEXT_MAP)) {
    writeDocs(ws, current, singleFile);
  }

  // The import graph rules are derived from the config: a new context or upstream changes them.
  if (ws.exists(DEPCRUISE_FILE)) {
    ws.update(DEPCRUISE_FILE, renderCruiseFile(current));
  }
}
