import type { Workspace } from '../workspace';
import { PRISMA_MAIN_SCHEMA, prismaSchemaOf } from '../prisma-schema';

/** Where the models end in the file of a context the repository generator starts. */
const END_OF_MODELS = '// /ddd-ts-kit:models';

/** One model or enum of a schema, its documentation comments included. */
const BLOCK = /^(?:\/\/\/[^\n]*\n)*(model|enum) (\w+) \{\n[\s\S]*?^\}$/gm;

/** What a partial unique index (`@@unique(..., where: ...)`) needs of the generator. */
const PARTIAL_INDEXES = 'partialIndexes';

/**
 * The models of a preset in the file of its context (`prisma/schema/<context>.prisma`): each takes
 * the place of the model of the same name its repository generator started, the others join the
 * models region, and the generator of the client turns on the partial indexes the preset relies on.
 */
export function layOutPrismaModels(ws: Workspace, models: string, context: string): void {
  const file = prismaSchemaOf(context);
  const own = ws.read(file);
  const main = ws.read(PRISMA_MAIN_SCHEMA);

  if (own === undefined || main === undefined) {
    ws.note(
      `${own === undefined ? file : PRISMA_MAIN_SCHEMA} does not exist: copy the models of the preset into ${file} by hand.`,
    );

    return;
  }

  const laidOut = [...models.matchAll(BLOCK)].reduce(
    (content, [block, kind, name]) => withBlock(content, block, `${kind ?? ''} ${name ?? ''}`),
    own,
  );

  ws.update(file, laidOut);
  ws.update(PRISMA_MAIN_SCHEMA, withPreviewFeature(main, PARTIAL_INDEXES));
  ws.note(`${file} changed: run \`npm run db:client\` to regenerate the client and the schema of the tests.`);
}

function withBlock(content: string, block: string, header: string): string {
  const existing = new RegExp(`^(?:///[^\\n]*\\n)*${header} \\{\\n[\\s\\S]*?^\\}$`, 'm');

  if (existing.test(content)) {
    return content.replace(existing, () => block);
  }

  const end = content.indexOf(END_OF_MODELS);

  return end === -1
    ? `${content.trimEnd()}\n\n${block}\n`
    : `${content.slice(0, end).trimEnd()}\n\n${block}\n${content.slice(end)}`;
}

/** The generator of the client with `feature` among its preview features, its assignments kept aligned. */
function withPreviewFeature(schema: string, feature: string): string {
  const body = /^generator client \{\n([\s\S]*?)^\}$/m.exec(schema)?.[1];

  return body === undefined ? schema : schema.replace(body, generatorWith(body, feature));
}

function generatorWith(body: string, feature: string): string {
  const listed = /^(\s*previewFeatures\s*=\s*\[)([^\]]*)\]/m.exec(body);

  if (listed === null) {
    const column = /^(\s*\w+\s*)=/m.exec(body)?.[1]?.length ?? 0;

    return `${body}${'  previewFeatures'.padEnd(column)}= ["${feature}"]\n`;
  }

  const [assignment, opening = '', features = ''] = listed;

  if (features.includes(`"${feature}"`)) {
    return body;
  }

  const all = [features.trim(), `"${feature}"`].filter((one) => one !== '');

  return body.replace(assignment, `${opening}${all.join(', ')}]`);
}
