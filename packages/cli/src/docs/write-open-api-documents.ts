import type { Config } from '../config';
import { describeContext } from '../describe/describe-context';
import type { Workspace } from '../workspace';
import { openApiDocumentsFile } from './open-api-documents-file';
import { readContext } from './read-context';
import { renderOpenApiDocuments } from './render-open-api-documents';

const SCRIPT = 'scripts/openapi.ts';

/**
 * Writes the documents of `openapi.documents`, each context resolved into the operations its
 * routes declare, for a project whose contract script reads them (every project `init` writes
 * since the contract can be split). A project with no HTTP boundary has no contract.
 */
export function writeOpenApiDocuments(ws: Workspace, config: Config): void {
  const file = openApiDocumentsFile(config);
  const read = ws.exists(file) || (ws.read(SCRIPT) ?? '').includes('openapi-documents');

  if (config.stack.http === 'none' || !read) {
    if (config.openapi.documents.length > 0 && config.stack.http !== 'none') {
      ws.note(
        `"openapi.documents" splits the contract, but ${SCRIPT} does not read ${file}: compare it with the script \`init\` writes (README of ddd-ts-kit, "Contracts").`,
      );
    }

    return;
  }

  const content = renderOpenApiDocuments(
    config.openapi.documents.map((document) => ({
      config: document,
      operations: [
        ...new Set(
          document.contexts.flatMap((name) =>
            describeContext(ws, config, readContext(ws, config, name)).routes.map((route) => route.operationId),
          ),
        ),
      ].sort(),
    })),
  );

  if (ws.exists(file)) {
    ws.update(file, content);
  } else {
    ws.create(file, content);
  }
}
