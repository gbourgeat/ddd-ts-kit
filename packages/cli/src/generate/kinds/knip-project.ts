import { isRecord } from '../../config/values/is-record';

/**
 * The part of knip.json that describes the project: the file itself, or its root workspace
 * (`workspaces["."]`) once the project has workspace packages (the clients of `ddd-ts-kit sdk`),
 * since knip then reads the entries of the root there and ignores those at the top.
 */
export function knipProject(knip: Record<string, unknown>): Record<string, unknown> {
  const workspaces = knip['workspaces'];
  const root = isRecord(workspaces) ? workspaces['.'] : undefined;

  return isRecord(root) ? root : knip;
}
