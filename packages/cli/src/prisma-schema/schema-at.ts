import type { PrismaBlock } from './prisma-blocks';

/** The `@@schema` of the block that holds the line (its index), undefined outside every block. */
export function schemaAt(blocks: readonly PrismaBlock[], index: number): string | undefined {
  return blocks.find(({ start, end }) => start <= index && index <= end)?.schema;
}
