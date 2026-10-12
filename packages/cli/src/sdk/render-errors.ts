import { renderTemplate } from '../templating/index.js';
import type { ClientDocument } from './client-document.js';
import { errorCodes } from './error-codes.js';
import { generatedHeader } from './generated-header.js';
import { schemaTypeName } from './schema-type-name.js';

const PROBLEM = 'Problem';

/** `errors.ts`: the error codes of the contract as a type, and the guards that narrow a refusal to them. */
export function renderErrors(document: ClientDocument): string {
  const codes = errorCodes(document);

  const problem = document.schemas.some(([name]) => name === PROBLEM)
    ? `Schemas.${schemaTypeName(PROBLEM)}`
    : 'unknown';

  return renderTemplate('sdk/errors.ts.tpl', {
    header: generatedHeader(document),
    codes: codes.length === 0 ? '[]' : `[\n${codes.map((code) => `  '${code}',`).join('\n')}\n]`,
    problem,
  });
}
