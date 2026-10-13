import { CLIENTS_DIRECTORY } from './clients-directory.js';
import type { PlannedClient } from './planned-client.js';

/**
 * The compiler options with one `paths` entry per client, its package name resolved to its
 * sources: a spec imports the client as a consumer would, and no build comes first. An entry
 * of a client that is gone is removed; every other entry is kept.
 */
export function withClientPaths(
  tsconfig: Record<string, unknown>,
  clients: readonly PlannedClient[],
): Record<string, unknown> {
  const options = record(tsconfig['compilerOptions']);
  const paths = record(options['paths']);
  const kept = Object.entries(paths).filter(([, targets]) => !pointsToClient(targets));
  const own = clients.map((client) => [client.packageName, [`./${client.directory}/src/index.ts`]] as const);

  return { ...tsconfig, compilerOptions: { ...options, paths: Object.fromEntries([...kept, ...own]) } };
}

function pointsToClient(targets: unknown): boolean {
  return Array.isArray(targets) && targets.some((target) => String(target).startsWith(`./${CLIENTS_DIRECTORY}/`));
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
}
