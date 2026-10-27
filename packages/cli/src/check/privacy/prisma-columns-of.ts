import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../model/project';
import { PRISMA_SCHEMA_FOLDER } from '../../prisma-schema';

/** A column of a model of the Prisma schema (`prisma/schema/`) that lives in the schema of a context. */
export interface PrismaColumn {
  readonly file: string;
  readonly context: string;
  readonly column: string;
  readonly field: string;
  readonly line: number;
}

const FIELD = /^\s{2}([A-Za-z_]\w*)\s+[A-Z]\w*(?:\[\]|\?)?(.*)$/;

/**
 * The columns of the models of the Prisma schema (every `.prisma` file of `prisma/schema/`) whose
 * `@@schema` is the schema of a context (its name, `-` written `_`): the name `@map` gives, or the
 * name of the field. Read from the disk: the files are no TypeScript source. Relations (a field
 * whose type is another model) and the attributes of a model are not columns.
 */
export function prismaColumnsOf(project: Project): PrismaColumn[] {
  const files = prismaFilesOf(project.root).map(({ file, text }) => ({ file, lines: text.split('\n') }));
  const contexts = new Map(project.contextsOnDisk.map((context) => [context.replaceAll('-', '_'), context]));

  const models = new Set(
    files.flatMap(({ lines }) => lines.flatMap((line) => /^model\s+(\w+)\s*\{/.exec(line)?.[1] ?? [])),
  );

  return files.flatMap(({ file, lines }) => columnsOf(file, lines, { contexts, models }));
}

function columnsOf(
  file: string,
  lines: readonly string[],
  { contexts, models }: { readonly contexts: ReadonlyMap<string, string>; readonly models: ReadonlySet<string> },
): PrismaColumn[] {
  return blocksOf(lines).flatMap(({ start, end }) => {
    const body = lines.slice(start + 1, end);
    const schema = body.map((line) => /@@schema\("([^"]+)"\)/.exec(line)?.[1]).find((found) => found !== undefined);
    const context = schema === undefined ? undefined : contexts.get(schema);

    return context === undefined
      ? []
      : body.flatMap((line, index) => {
          const [, field, rest = ''] = FIELD.exec(line) ?? [];
          const type = /^\s{2}\w+\s+(\w+)/.exec(line)?.[1] ?? '';

          if (field === undefined || models.has(type) || rest.includes('@relation')) {
            return [];
          }

          return [
            {
              file,
              context,
              field,
              column: /@map\("([^"]+)"\)/.exec(rest)?.[1] ?? field,
              line: start + index + 2,
            },
          ];
        });
  });
}

/** The lines that open and close each model. */
function blocksOf(lines: readonly string[]): { readonly start: number; readonly end: number }[] {
  return lines.flatMap((line, start) => {
    if (!/^model\s+\w+\s*\{/.test(line)) {
      return [];
    }

    const end = lines.findIndex((other, index) => index > start && other.startsWith('}'));

    return [{ start, end: end === -1 ? lines.length : end }];
  });
}

/** The `.prisma` files of the schema folder, by their path from the root, as Prisma reads them: subfolders included. */
function prismaFilesOf(root: string): { readonly file: string; readonly text: string }[] {
  return readTree(path.join(root, PRISMA_SCHEMA_FOLDER))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.prisma'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
    .map((absolute) => ({
      file: path.relative(root, absolute).split(path.sep).join('/'),
      text: fs.readFileSync(absolute, 'utf8'),
    }));
}

function readTree(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
}
