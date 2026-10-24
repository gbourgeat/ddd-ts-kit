import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../model/project';

const PRISMA_SCHEMA = 'prisma/schema.prisma';

/** A column of a model of `prisma/schema.prisma` that lives in the schema of a context. */
export interface PrismaColumn {
  readonly file: string;
  readonly context: string;
  readonly column: string;
  readonly field: string;
  readonly line: number;
}

const FIELD = /^\s{2}([A-Za-z_]\w*)\s+[A-Z]\w*(?:\[\]|\?)?(.*)$/;

/**
 * The columns of the models of `prisma/schema.prisma` whose `@@schema` is the schema of a context
 * (its name, `-` written `_`): the name `@map` gives, or the name of the field. Read from the
 * disk: the file is no TypeScript source. Relations (a field whose type is another model) and the
 * attributes of a model are not columns.
 */
export function prismaColumnsOf(project: Project): PrismaColumn[] {
  const text = readIfPresent(path.join(project.root, PRISMA_SCHEMA));
  const contexts = new Map(project.contextsOnDisk.map((context) => [context.replaceAll('-', '_'), context]));
  const lines = text.split('\n');
  const models = new Set(lines.flatMap((line) => /^model\s+(\w+)\s*\{/.exec(line)?.[1] ?? []));

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
              file: PRISMA_SCHEMA,
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

function readIfPresent(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
