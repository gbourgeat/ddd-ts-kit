import type { ClientDocument } from './client-document';
import { generatedHeader } from './generated-header';
import { renderOperation } from './render-operation';

const IMPORTS = [
  "import type * as Schemas from './schemas.js';",
  "import { send, type CallOptions, type Connection, type Failure, type Operation, type Success } from './runtime.js';",
].join('\n');

/** `operations.ts`: the types and the function of every operation, each callable on its own (what is not imported is not bundled). */
export function renderOperations(document: ClientDocument): string {
  const blocks = document.operations.map(renderOperation);

  return `${[generatedHeader(document), IMPORTS, ...blocks].join('\n\n')}\n`;
}
