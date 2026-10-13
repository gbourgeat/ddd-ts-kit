import { read, write } from '../helpers.js';

const HTTP = 'src/contexts/billing/presentation/http';
const MONEY = `${HTTP}/shared/money.schema.ts`;
const MONEY_IMPORT = "import { moneySchema } from '@/contexts/billing/presentation/http/shared/money.schema';\n";
const TODO = /\n {4}\/\/ TODO\(domain\): declare the fields the client sends[^\n]*\n {2}/;

/** The shape declared once by `generate schema billing Money`, and how a body nests it, in each library. */
const BY_LIBRARY: Readonly<Record<string, { money: string; field: string }>> = {
  zod: {
    money:
      "import { z } from 'zod';\n\nexport const moneySchema = z\n  .object({ cents: z.number().int(), currency: z.string().length(3) })\n  .meta({ id: 'Money' });\n",
    field: ' {{field}}: moneySchema.optional() ',
  },
  typebox: {
    money:
      "import Type from 'typebox';\n\nexport const moneySchema = Type.Object(\n  { cents: Type.Integer(), currency: Type.String({ minLength: 3, maxLength: 3 }) },\n  { $id: 'Money' },\n);\n",
    field: ' {{field}}: Type.Optional(moneySchema) ',
  },
};

const CLASS_MONEY =
  "import { IsInt, Length } from 'class-validator';\n\nexport class Money {\n  @IsInt()\n  cents = 0;\n\n  @Length(3, 3)\n  currency = '';\n}\n";

/** The shared shape filled in, and nested in the body of each route under a field of its own: two bodies of one shape would be a duplicate. */
export function shareMoney(root: string, validation: string, uses: Readonly<Record<string, string>>): void {
  if (validation === 'class-validator') {
    write(root, MONEY, CLASS_MONEY);
    Object.entries(uses).forEach(([use, field]) => nestClass(root, use, field));

    return;
  }

  const library = BY_LIBRARY[validation];

  if (library === undefined) {
    throw new Error(`No shared shape is written for ${validation}.`);
  }

  write(root, MONEY, library.money);

  for (const [use, field] of Object.entries(uses)) {
    nestObject(root, `${HTTP}/invoices/${use}/${use}.controller.ts`, library.field.replace('{{field}}', field));
  }
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
