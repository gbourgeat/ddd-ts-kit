import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../model/project';

/** A file that declares tables, by its path from the root, with its text. */
export interface SchemaSource {
  readonly file: string;
  readonly text: string;
}

const MIGRATION_EXTENSIONS = new Set(['.sql', '.js', '.ts', '.mjs', '.cjs']);

/**
 * What declares the tables of a project: the persistence sources of the contexts and of the
 * platform database, the migrations (`migrations/`, `drizzle/`, `prisma/migrations/`) and the
 * Prisma schema. Specs are not read.
 */
export function schemaSources(project: Project): SchemaSource[] {
  const database = `${project.config.platformDir}/database/`;

  const sources = project.files
    .filter((file) => !file.isTest && (persistenceOfAContext(file.location) || file.path.startsWith(database)))
    .map(({ path: file, text }) => ({ file, text }));

  return [...sources, ...['migrations', 'drizzle', 'prisma'].flatMap((folder) => filesUnder(project.root, folder))];
}

function persistenceOfAContext(location: Project['files'][number]['location']): boolean {
  return location.area === 'context' && location.layer === 'infrastructure' && location.inside[0] === 'persistence';
}

function filesUnder(root: string, folder: string): SchemaSource[] {
  const entries = readTree(path.join(root, folder));

  return entries
    .filter(
      (entry) =>
        entry.isFile() && (MIGRATION_EXTENSIONS.has(path.extname(entry.name)) || entry.name.endsWith('.prisma')),
    )
    .filter((entry) => !entry.name.endsWith('.d.ts'))
    .map((entry) => {
      const absolute = path.join(entry.parentPath, entry.name);

      return { file: path.relative(root, absolute).split(path.sep).join('/'), text: fs.readFileSync(absolute, 'utf8') };
    });
}

function readTree(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
}
