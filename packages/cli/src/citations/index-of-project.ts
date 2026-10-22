import type { Project } from '../check/model/project';
import type { Declaration } from './declaration';
import type { NameIndex } from './name-index';
import { nameIndexOf } from './name-index-of';

const DECLARATION = /(?<![\w$])(?:class|interface|type|enum|function|const)\s+([A-Z][\w$]*)/g;

/** What the working tree has, from the project the checker loaded: its files and the names its sources declare. */
export function indexOfProject(project: Project): NameIndex {
  const declarations = project.files.flatMap((file) =>
    [...file.scan.code.matchAll(DECLARATION)].map(([, name = '']): Declaration => ({ file: file.path, name })),
  );

  const files = [
    ...project.files.map((file) => file.path),
    ...project.contextEntries.filter((entry) => !entry.endsWith('/')),
  ];

  return nameIndexOf(declarations, [...new Set(files)]);
}
