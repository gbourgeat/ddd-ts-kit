import { withEntry } from './with-entry';

/** Keys of knip.json that apply to the whole repository, whatever the workspace. */
const ROOT_KEYS = new Set([
  '$schema',
  'workspaces',
  'ignoreWorkspaces',
  'ignoreDependencies',
  'ignoreBinaries',
  'ignoreUnresolved',
  'ignoreMembers',
  'ignoreExportsUsedInFile',
  'includeEntryExports',
  'ignoreIssues',
  'rules',
  'include',
  'exclude',
  'tags',
  'treatConfigHintsAsErrors',
]);

/**
 * knip.json once the project has workspace packages: knip then reads the root as one workspace
 * among others, so what the file said of the project (its entries, its files, the config of its
 * plugins) moves under `workspaces["."]`, and the clients are left out, as generated code.
 */
export function withKnipWorkspaces(knip: Record<string, unknown>, packages: string): Record<string, unknown> {
  const ignoreWorkspaces = withEntry(knip['ignoreWorkspaces'], packages);

  if (knip['workspaces'] !== undefined) {
    return { ...knip, ignoreWorkspaces };
  }

  const entries = Object.entries(knip);
  const project = Object.fromEntries(entries.filter(([key]) => !ROOT_KEYS.has(key)));
  const [schema, ...root] = entries.filter(([key]) => ROOT_KEYS.has(key) && key !== 'ignoreWorkspaces');

  return {
    ...Object.fromEntries(schema === undefined ? [] : [schema]),
    workspaces: { '.': project },
    ...Object.fromEntries(root),
    ignoreWorkspaces,
  };
}
