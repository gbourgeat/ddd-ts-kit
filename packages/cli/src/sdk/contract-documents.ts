import { CliError } from '../cli-error';
import type { Config } from '../config';
import { fromYaml } from '../yaml/from-yaml';
import type { Workspace } from '../workspace';
import type { ClientDocument } from './client-document';
import { readClientDocument } from './read-client-document';

const DIRECTORY = 'openapi';
/** The file of the whole contract; its client is named `api`. */
const WHOLE = 'openapi';
const WHOLE_CLIENT = 'api';

/**
 * The documents of the contract as the scripts of the project wrote them (`openapi/<document>`
 * in the format of "openapi.format"), each read as its client needs: the client of the whole
 * contract is `api`, the client of a document of a split contract has its name, "openapi"
 * included. Two documents whose clients would share a directory are refused.
 */
export function contractDocuments(ws: Workspace, config: Config): ClientDocument[] {
  const format = config.openapi.format === 'json' ? 'json' : 'yaml';
  const split = config.openapi.documents.length > 0;

  const documents = ws
    .list(DIRECTORY)
    .filter((file) => file.endsWith(`.${format}`))
    .map((file) => {
      const source = `${DIRECTORY}/${file}`;
      const stem = file.slice(0, -format.length - 1);
      const name = !split && stem === WHOLE ? WHOLE_CLIENT : stem;

      return readClientDocument({ name, source }, parsed(ws, source, format));
    });

  refuseSharedDirectories(documents);

  return documents;
}

/** Without a split, `openapi/openapi.yaml` and a stray `openapi/api.yaml` would both write `clients/api`. */
function refuseSharedDirectories(documents: readonly ClientDocument[]): void {
  const shared = documents.find(
    (document, index) => documents.findIndex((other) => other.name === document.name) !== index,
  );

  if (shared !== undefined) {
    const sources = documents.filter((document) => document.name === shared.name).map((document) => document.source);

    throw new CliError(
      `${sources.join(' and ')} would both write the client clients/${shared.name}.`,
      'Delete the document the contract no longer has, or split the contract under "openapi.documents", where each document names its client.',
    );
  }
}

function parsed(ws: Workspace, source: string, format: string): unknown {
  const text = ws.read(source) ?? '';

  try {
    return format === 'json' ? JSON.parse(text) : fromYaml(text);
  } catch (error) {
    throw new CliError(
      `${source} cannot be read: ${error instanceof Error ? error.message : String(error)}.`,
      'Write it again from the routes with the script `docs:generate`: the client is generated from the contract the scripts write.',
    );
  }
}
