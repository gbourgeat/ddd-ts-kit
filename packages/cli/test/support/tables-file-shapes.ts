import { read, write } from '../helpers';

const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';
const TABLES = `${PERSISTENCE}/billing.schema.ts`;
const MOVED = `${PERSISTENCE}/billing-tables.ts`;
const ALIASED = '@/contexts/billing/infrastructure/persistence/billing-tables';

/** Rewrites the tables file of billing, which holds the table `orders` as generated, the way a team may write it. */
type Shape = (root: string) => void;

/** The declaration of `orders` as generated, written another way. */
function declaredAs(written: (declaration: string) => string): Shape {
  return (root) => {
    const tables = read(root, TABLES);

    write(root, TABLES, tables.replace(/^export const orders = /m, written));
  };
}

/** The tables moved to a file beside the tables file, which then holds `content`. */
function movedBehind(content: string, more: Readonly<Record<string, string>> = {}): Shape {
  return (root) => {
    write(root, MOVED, read(root, TABLES));

    for (const [file, text] of Object.entries(more)) {
      write(root, `${PERSISTENCE}/${file}`, text);
    }

    write(root, TABLES, content);
  };
}

/** `orders` held in an object and exported through a pattern. */
const destructured: Shape = (root) => {
  const tables = read(root, TABLES);
  const opened = tables.replace(/^export const orders = /m, 'const tables = { orders: ');

  const closed = opened.replace(
    /\n\}\);\n\/\/ \/ddd-ts-kit:tables/,
    '\n}) };\nexport const { orders } = tables;\n// /ddd-ts-kit:tables',
  );

  write(root, TABLES, closed);
};

const ANOTHER: Readonly<Record<string, string>> = {
  drizzle: "billingSchema.table('lines', { id: text('id').primaryKey() })",
  typeorm:
    "new EntitySchema({ name: 'BillingLine', tableName: 'lines', schema: BILLING_SCHEMA, columns: { id: { type: 'text', primary: true } } })",
};

/** The shapes a tables file is read in with certainty: every table of each reaches the index. */
export const READABLE_SHAPES: Readonly<Record<string, Shape>> = {
  'as generated': () => undefined,
  're-exported from a file beside it': movedBehind("export * from './billing-tables';\n"),
  're-exported through two files': movedBehind("export * from './billing-more';\n", {
    'billing-more.ts': "export * from './billing-tables';\n",
  }),
  're-exported with a .js ending': movedBehind("export * from './billing-tables.js';\n"),
  're-exported through the alias of the project': movedBehind(`export * from '${ALIASED}';\n`),
  'declared, then exported under its name': (root) => {
    declaredAs(() => 'const held = ')(root);
    write(root, TABLES, `${read(root, TABLES)}\nexport { held as orders };\n`);
  },
  're-exported in a circle': (root) => {
    movedBehind("export * from './billing-tables';\n")(root);
    write(root, MOVED, `${read(root, MOVED)}\nexport * from './billing.schema';\n`);
  },
  'two spaces after export': declaredAs(() => 'export  const orders = '),
  'export indented': declaredAs(() => '  export const orders = '),
  'the name on the next line': declaredAs(() => 'export const\n  orders = '),
};

/** The shapes the kit cannot read with certainty: it must then write nothing that could hide a table. */
export function unreadShapes(orm: string): Readonly<Record<string, Shape>> {
  return {
    'exported through a pattern': destructured,
    'the second declarator of one statement': declaredAs(
      () => `export const lines = ${ANOTHER[orm] ?? ''},\n  orders = `,
    ),
  };
}
