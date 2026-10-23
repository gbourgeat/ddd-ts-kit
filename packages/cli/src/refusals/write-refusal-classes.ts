import path from 'node:path';
import { specifierOf } from '../alias';
import type { Config } from '../config';
import { CODES_FILE, contextFileAt } from '../context-files';
import type { MigrationDraft } from './migration-draft';
import type { NamedMove } from './named-move';
import { refusalClassFile } from './refusal-class-file';
import { withCodes } from './with-codes';

/**
 * Writes one file per refusal class, with the factories of its moves, and the list of the codes
 * of each context that names those classes, in the order of the plan.
 */
export function writeRefusalClasses(config: Config, moves: readonly NamedMove[], draft: MigrationDraft): void {
  for (const context of [...new Set(moves.map((move) => move.context))]) {
    // The code list stays one per context; each refusal class is written next to the error it comes from.
    const directory = `${config.contextsDir}/${context}`;
    const codesFile = `${directory}/${contextFileAt(CODES_FILE, context, (relative) => draft.read(`${directory}/${relative}`) !== undefined)}`;
    const own = moves.filter((move) => move.context === context);

    for (const className of [...new Set(own.map((move) => move.className))]) {
      const ofClass = own.filter((move) => move.className === className);
      const [first] = ofClass;
      const file = `${first === undefined ? `${directory}/domain/errors` : path.posix.dirname(first.oldFile)}/${first?.classFile ?? ''}.ts`;
      const refusal = { file, className, context, codesSpecifier: specifierOf(config, codesFile), moves: ofClass };

      draft.write(file, refusalClassFile(draft.read(file), refusal));
    }

    const entries = own.map((move) => ({ key: move.className, code: move.code }));

    draft.write(codesFile, withCodes(draft.read(codesFile), context, entries));
  }
}
