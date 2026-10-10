import type { Workspace } from '../../../workspace/index.js';

const COMPOSE = 'docker-compose.yml';

/** Adds a service to the compose file, once: the services end where the top-level `volumes:` key begins, or with the file. */
export function addComposeService(ws: Workspace, name: string, service: string): void {
  const compose = ws.read(COMPOSE);

  if (compose === undefined || compose.includes(`\n  ${name}:\n`)) {
    return;
  }

  const volumes = compose.indexOf('\nvolumes:');
  const head = (volumes === -1 ? compose : compose.slice(0, volumes)).trimEnd();
  const tail = volumes === -1 ? '\n' : `\n${compose.slice(volumes)}`;

  ws.update(COMPOSE, `${head}\n${service.trimEnd()}\n${tail}`);
}
