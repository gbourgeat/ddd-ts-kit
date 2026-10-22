import type { Config } from '../config';
import { CliError } from '../cli-error';
import { refreshBarrels, type SingleFile } from '../generate/refresh-barrels';
import { replaceRegion } from '../markers';
import { readTemplate, renderTemplate } from '../templating';
import type { Workspace } from '../workspace';
import { brokerStrategy } from './broker-strategy';
import { CONTEXT_MAP } from './context-map-file';
import { contextMapLines } from './context-map-lines';
import { readContexts } from './read-contexts';
import { refreshContextDoc } from './refresh-context-doc';
import { writeCodeOwners } from './write-code-owners';
import { writeOpenApiDocuments } from './write-open-api-documents';

const INTEGRATION_README = 'docs/integration/README.md';

/**
 * Plans every generated part of the documentation: the lists of each CONTEXT.md, the block
 * of the context map, the barrel of each declared context, the code owners once an owner is
 * configured, and, once, the skeleton of what only people can write. The caller commits the workspace, or reads what it would change to detect drift.
 * Answers the contexts left in the single declarations file of 0.84, which `singleFile` keeps.
 */
export function writeDocs(ws: Workspace, config: Config, singleFile: SingleFile = 'move'): string[] {
  const contexts = readContexts(ws, config);

  for (const context of contexts) {
    if (context.declared && context.onDisk) {
      refreshContextDoc(ws, config, context.name);
    }
  }

  writeContextMap(ws, contextMapLines(contexts));

  const kept = refreshBarrels(ws, config, singleFile);

  writeOpenApiDocuments(ws, config);
  writeCodeOwners(ws, config, contexts);

  // Written by people from here on: never replaced, not even with --force.
  if (!ws.exists(INTEGRATION_README)) {
    ws.create(
      INTEGRATION_README,
      renderTemplate('docs/integration-readme.md.tpl', { integration: { strategy: brokerStrategy(config) } }),
    );
  }

  return kept;
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

  if (existing === undefined) {
    ws.create(CONTEXT_MAP, next);
  } else {
    ws.update(CONTEXT_MAP, next);
  }
}
