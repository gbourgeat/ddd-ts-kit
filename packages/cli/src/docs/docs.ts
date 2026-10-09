import type { Config } from '../config.js';
import { CliError } from '../errors.js';
import { replaceRegion } from '../markers.js';
import { readTemplate } from '../templates.js';
import type { Workspace } from '../workspace.js';
import { refreshContextDoc } from './context-doc.js';
import { contextMapLines } from './context-map.js';
import { readContexts } from './model.js';

export const CONTEXT_MAP = 'docs/context-map.md';
const INTEGRATION_README = 'docs/integration/README.md';

/**
 * Plans every generated part of the documentation: the lists of each CONTEXT.md, the block
 * of the context map, and, once, the skeleton of what only people can write. The caller
 * commits the workspace, or reads what it would change to detect drift.
 */
export function writeDocs(ws: Workspace, config: Config): void {
  const contexts = readContexts(ws, config);
  for (const context of contexts) {
    if (context.declared && context.onDisk) refreshContextDoc(ws, config, context.name);
  }
  writeContextMap(ws, contextMapLines(contexts));
  // Written by people from here on: never replaced, not even with --force.
  if (!ws.exists(INTEGRATION_README)) ws.create(INTEGRATION_README, readTemplate('docs/integration-readme.md.tpl'));
}

function writeContextMap(ws: Workspace, lines: readonly string[]): void {
  const existing = ws.read(CONTEXT_MAP);
  const next = replaceRegion(existing ?? readTemplate('docs/context-map.md.tpl'), 'context-map', lines);
  if (next === undefined) {
    throw new CliError(
      `${CONTEXT_MAP} has no "ddd-ts-kit:context-map" markers.`,
      'Put back `<!-- ddd-ts-kit:context-map -->` and `<!-- /ddd-ts-kit:context-map -->` where the generated diagram and table belong; the text around them is yours.',
    );
  }
  if (existing === undefined) ws.create(CONTEXT_MAP, next);
  else ws.update(CONTEXT_MAP, next);
}
