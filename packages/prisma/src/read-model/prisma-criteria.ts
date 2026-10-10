/** A `where` of Prisma, as plain data: what `findMany`, `count` and `updateMany` take. */
export type PrismaWhere = Readonly<Record<string, unknown>>;

/** A criteria plan as the arguments of a Prisma `findMany`. */
export interface PrismaCriteria {
  /** The filters, the scope of the actor and the keyset of a cursor page. */
  readonly where: PrismaWhere;
  /** The filters and the scope alone: what the total of an offset page counts. */
  readonly counted: PrismaWhere;
  readonly orderBy: Readonly<Record<string, unknown>>[];
  readonly take: number;
  readonly skip: number;
}
