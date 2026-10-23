import type { Workspace } from '../workspace';

/** Directories of installed, built or measured files: nothing a person wrote. */
const SKIPPED = new Set(['node_modules', 'dist', 'coverage', 'generated', '.git']);

/** Every Markdown file of the project, from its root, outside the directories nobody writes in. */
export function markdownFiles(ws: Workspace, directory = '.'): string[] {
  const at = (name: string): string => (directory === '.' ? name : `${directory}/${name}`);
  const here = ws.list(directory).filter((name) => name.endsWith('.md'));

  const below = ws
    .directories(directory)
    .filter((name) => !SKIPPED.has(name))
    .flatMap((name) => markdownFiles(ws, at(name)));

  return [...here.map(at), ...below];
}
