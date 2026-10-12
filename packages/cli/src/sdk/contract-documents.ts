import { CliError } from '../cli-error.js';
import type { Config } from '../config/index.js';
import { fromYaml } from '../yaml/from-yaml.js';
import type { Workspace } from '../workspace/index.js';
import type { ClientDocument } from './client-document.js';
import { readClientDocument } from './read-client-document.js';

const DIRECTORY = 'openapi';
/** The file of the whole contract; its client is named `api`. */
const WHOLE = 'openapi';
const WHOLE_CLIENT = 'api';

/**
 * The documents of the contract as the scripts of the project wrote them (`openapi/<document>`
 * in the format of "openapi.format"), each read as its client needs: the client of the whole
 * contract is `api`, the client of a document has its name.
 */
export function contractDocuments(ws: Workspace, config: Config): ClientDocument[] {
  const format = config.openapi.format === 'json' ? 'json' : 'yaml';

  return ws
    .list(DIRECTORY)
    .filter((file) => file.endsWith(`.${format}`))
    .map((file) => {
      const source = `${DIRECTORY}/${file}`;
      const stem = file.slice(0, -format.length - 1);

      return readClientDocument({ name: stem === WHOLE ? WHOLE_CLIENT : stem, source }, parsed(ws, source, format));
    });
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
