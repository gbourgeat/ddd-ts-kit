const OPENS = /^(?:model|enum|view|type)\s+\w+\s*\{/;
const SCHEMA = /@@schema\("([^"]+)"\)/;

/** A model, an enum or a view of a Prisma schema: the lines that open and close it, and its `@@schema`, empty without one. */
export interface PrismaBlock {
  readonly start: number;
  readonly end: number;
  readonly schema: string;
}

/** The blocks of a Prisma schema, by the index of their lines. */
export function prismaBlocks(lines: readonly string[]): PrismaBlock[] {
  return lines.flatMap((line, start) => {
    if (!OPENS.test(line)) {
      return [];
    }

    const closing = lines.findIndex((other, index) => index > start && other.startsWith('}'));
    const end = closing === -1 ? lines.length - 1 : closing;
    const schema = lines.slice(start, end + 1).flatMap((inside) => SCHEMA.exec(inside)?.[1] ?? [])[0] ?? '';

    return [{ start, end, schema }];
  });
}
