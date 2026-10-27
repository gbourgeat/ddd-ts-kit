import { PRISMA_MAIN_SCHEMA } from './prisma-main-schema';
import { PRISMA_SCHEMA_FOLDER } from './prisma-schema-folder';
import { prismaSchemaOf } from './prisma-schema-of';
import { schemaOfContext } from './schema-of-context';
import { SINGLE_PRISMA_SCHEMA } from './single-prisma-schema';

/**
 * The steps that lay the schema out as 0.95 does, the contexts of the project named: the tables
 * stay the same, so no migration follows.
 */
export function singlePrismaSchemaSteps(contexts: readonly string[]): string {
  const each =
    contexts.length === 0
      ? `the models and enums of each context (those whose \`@@schema\` is the schema of the context) into ${prismaSchemaOf('<context>')}`
      : contexts
          .map(
            (context) =>
              `the models and enums whose \`@@schema\` is "${schemaOfContext(context)}" into ${prismaSchemaOf(context)}`,
          )
          .join(', ');

  return [
    `To move: \`mkdir ${PRISMA_SCHEMA_FOLDER} && git mv ${SINGLE_PRISMA_SCHEMA} ${PRISMA_MAIN_SCHEMA}\`;`,
    'in that file write the `output` of the generator one level up (`"../../generated/prisma"`);',
    `move out of its \`// ddd-ts-kit:models\` region ${each}, each file holding them between a \`// ddd-ts-kit:models\` and a \`// /ddd-ts-kit:models\` line of its own, then remove the emptied region;`,
    `in prisma.config.ts set \`schema: './${PRISMA_SCHEMA_FOLDER}'\`;`,
    `in the \`db:client\` script of package.json replace \`--to-schema ${SINGLE_PRISMA_SCHEMA}\` by \`--to-schema ${PRISMA_SCHEMA_FOLDER}\`;`,
    'then run `npm run db:client`: the tables are the same, so `npm run db:generate` finds no change and no migration is needed.',
  ].join(' ');
}
