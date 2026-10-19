import { CliError } from '../cli-error.js';
import { addFactory } from '../generate/errors/add-factory.js';
import { fitSource } from '../layout/index.js';
import { toName } from '../naming/index.js';
import { importsUsedBy } from './imports-used-by.js';
import type { NamedMove } from './named-move.js';

/** The refusal class of a context, the moves that give it its factories, and how its file imports the codes. */
export interface RefusalClass {
  readonly file: string;
  readonly className: string;
  readonly context: string;
  readonly codesSpecifier: string;
  readonly moves: readonly NamedMove[];
}

/**
 * The file of a refusal class: its code read from the list of the context, its factories, and the
 * imports they read. A file that already declares the class only gains the factories it lacks.
 */
export function refusalClassFile(existing: string | undefined, refusal: RefusalClass): string {
  if (existing === undefined) {
    return fitSource(fresh(refusal));
  }

  const added = refusal.moves.reduce<string | undefined>(
    (source, move) =>
      source === undefined
        ? undefined
        : addFactory(source, { className: refusal.className, name: move.factory, text: move.text }),
    existing,
  );

  if (added === undefined) {
    throw new CliError(
      `${refusal.file} holds another class than ${refusal.className}.`,
      `Give ${refusal.className} another name in the plan, then run \`ddd-ts-kit error-factories --apply\` again.`,
    );
  }

  return fitSource(added);
}

function fresh({ className, context, codesSpecifier, moves }: RefusalClass): string {
  const list = `${toName(context).pascal}Codes`;
  const factories = moves.map((move) => move.text);
  const carried = [...new Set(moves.flatMap((move) => move.imports))];

  return [
    "import { DomainRefusal } from '@ddd-ts-kit/kernel';\n",
    ...importsUsedBy(carried, factories.join('\n')),
    `import { ${list} } from '${codesSpecifier}';\n`,
    '\n',
    `export class ${className} extends DomainRefusal {\n`,
    `  readonly code = ${list}.${className};\n`,
    '\n',
    `${factories.join('\n\n')}\n`,
    '}\n',
  ].join('');
}
