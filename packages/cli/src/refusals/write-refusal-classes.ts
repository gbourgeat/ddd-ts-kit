import { specifierOf } from '../alias/index.js';
import type { Config } from '../config/index.js';
import type { MigrationDraft } from './migration-draft.js';
import type { NamedMove } from './named-move.js';
import { refusalClassFile } from './refusal-class-file.js';
import { withCodes } from './with-codes.js';

/**
 * Writes one file per refusal class, with the factories of its moves, and the list of the codes
 * of each context that names those classes, in the order of the plan.
 */
export function writeRefusalClasses(config: Config, moves: readonly NamedMove[], draft: MigrationDraft): void {
  for (const context of [...new Set(moves.map((move) => move.context))]) {
    const errors = `${config.contextsDir}/${context}/domain/errors`;
    const codesFile = `${errors}/codes.ts`;
    const own = moves.filter((move) => move.context === context);

    for (const className of [...new Set(own.map((move) => move.className))]) {
      const ofClass = own.filter((move) => move.className === className);
      const file = `${errors}/${ofClass[0]?.classFile ?? ''}.ts`;
      const refusal = { file, className, context, codesSpecifier: specifierOf(config, codesFile), moves: ofClass };

      draft.write(file, refusalClassFile(draft.read(file), refusal));
    }

    const entries = own.map((move) => ({ key: move.className, code: move.code }));

    draft.write(codesFile, withCodes(draft.read(codesFile), context, entries));
  }
}
