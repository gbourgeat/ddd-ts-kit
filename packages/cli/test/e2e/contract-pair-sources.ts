import { read, write } from '../helpers.js';

const HTTP = 'src/contexts/billing/presentation/http';
const MONEY = `${HTTP}/shared/money.schema.ts`;
const MONEY_IMPORT = "import { moneySchema } from '@/contexts/billing/presentation/http/shared/money.schema';\n";
const TODO = /\n {4}\/\/ TODO\(domain\): declare the fields the client sends[^\n]*\n {2}/;

const SCHEMA_TODO = /\/\/ TODO\(domain\): declare the fields of "money"[^\n]*/;

/** The fields `generate schema billing Money` leaves to write, in each library, and how a body nests the shape. */
const BY_LIBRARY: Readonly<Record<string, { fields: string; field: string }>> = {
  zod: {
    fields: 'cents: z.number().int(),\n    currency: z.string().length(3),',
    field: ' {{field}}: moneySchema.optional() ',
  },
  typebox: {
    fields: 'cents: Type.Integer(),\n    currency: Type.String({ minLength: 3, maxLength: 3 }),',
    field: ' {{field}}: Type.Optional(moneySchema) ',
  },
};

const CLASS_FIELDS = "@IsInt()\n  cents = 0;\n\n  @Length(3, 3)\n  currency = '';";
const CLASS_IMPORT = "import { IsInt, Length } from 'class-validator';\n\n";

/**
 * The shared shape filled in where the generator left it to write, and nested in the body of each
 * route under a field of its own: two bodies of one shape would be a duplicate.
 */
export function shareMoney(root: string, validation: string, uses: Readonly<Record<string, string>>): void {
  if (validation === 'class-validator') {
    write(root, MONEY, `${CLASS_IMPORT}${filled(root, CLASS_FIELDS)}`);
    Object.entries(uses).forEach(([use, field]) => nestClass(root, use, field));

    return;
  }

  const library = BY_LIBRARY[validation];

  if (library === undefined) {
    throw new Error(`No shared shape is written for ${validation}.`);
  }

  write(root, MONEY, filled(root, library.fields));

  for (const [use, field] of Object.entries(uses)) {
    nestObject(root, `${HTTP}/invoices/${use}/${use}.controller.ts`, library.field.replace('{{field}}', field));
  }
}

/** The file `generate schema` wrote, its TODO replaced by the fields: the rest is analysed as generated. */
function filled(root: string, fields: string): string {
  const generated = read(root, MONEY);

  if (!SCHEMA_TODO.test(generated)) {
    throw new Error(`generate schema left no TODO to fill in ${MONEY}.`);
  }

  return generated.replace(SCHEMA_TODO, fields);
}

function nestObject(root: string, controller: string, field: string): void {
  const source = read(root, controller);
  const lastImport = source.lastIndexOf('\nimport ');
  const importEnd = source.indexOf('\n', lastImport + 1) + 1;

  write(
    root,
    controller,
    `${source.slice(0, importEnd)}${MONEY_IMPORT}${source.slice(importEnd)}`.replace(TODO, `${field}`),
  );
}

function nestClass(root: string, use: string, field: string): void {
  write(
    root,
    `${HTTP}/invoices/${use}/${use}.body.ts`,
    `import { Type } from 'class-transformer';\nimport { IsOptional, ValidateNested } from 'class-validator';\nimport { Money } from '@/contexts/billing/presentation/http/shared/money.schema';\n\nexport class ${pascal(use)}Body {\n  @IsOptional()\n  @ValidateNested()\n  @Type(() => Money)\n  ${field}?: Money;\n}\n`,
  );
}

function pascal(kebab: string): string {
  return kebab.replace(/(?:^|-)([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
