import type { Config } from '../config';
import { formatJson } from '../json/format-json';
import type { Workspace } from '../workspace';
import { clientFiles } from './client-files';
import { clientManifest } from './client-manifest';
import { CLIENTS_DIRECTORY } from './clients-directory';
import type { PlannedClient } from './planned-client';
import { putFile } from './put-file';

/**
 * Writes the client of every document of the contract, and the build config that compiles them
 * all (`tsc -b clients`). A client whose document is gone is not deleted: it is answered, with
 * its directory, for the command to say.
 */
export function writeClients(ws: Workspace, config: Config, clients: readonly PlannedClient[]): string[] {
  for (const client of clients) {
    writeClient(ws, config, client);
  }

  if (clients.length > 0) {
    putFile(
      ws,
      `${CLIENTS_DIRECTORY}/tsconfig.json`,
      formatJson({ files: [], references: clients.map((client) => ({ path: `./${client.document.name}` })) }),
    );
  }

  const names = new Set(clients.map((client) => client.document.name));

  return ws
    .directories(CLIENTS_DIRECTORY)
    .filter((name) => !names.has(name) && ws.exists(`${CLIENTS_DIRECTORY}/${name}/src/runtime.ts`))
    .map((name) => `${CLIENTS_DIRECTORY}/${name}`);
}

function writeClient(ws: Workspace, config: Config, { document, packageName, directory }: PlannedClient): void {
  for (const [file, content] of clientFiles(document, packageName, directory)) {
    putFile(ws, `${directory}/${file}`, content);
  }

  const manifest = `${directory}/package.json`;
  const facts = { name: packageName, version: document.version, title: document.title, access: config.sdk?.access };

  putFile(ws, manifest, clientManifest(facts, ws.read(manifest)));
}
