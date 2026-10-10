/** A JSON value as Prisma accepts it in a `Json` field. */
export type PrismaJsonInput =
  | string
  | number
  | boolean
  | { readonly [key: string]: PrismaJsonInput | null }
  | readonly (PrismaJsonInput | null)[];
