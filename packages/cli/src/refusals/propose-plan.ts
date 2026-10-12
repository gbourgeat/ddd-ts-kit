import type { Config } from '../config/index.js';
import { splitWords, toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import { factoryNameFor } from './factory-name-for.js';
import type { LegacyError } from './legacy-error.js';
import type { MigrationPlan } from './migration-plan.js';
import type { PlannedFactory } from './planned-factory.js';

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

/**
 * A proposal: each class per error goes to the aggregate its name or its code starts or ends
 * with, and to nothing when none does. Which concept a refusal is about is a decision of the
 * model: the proposal is edited before it is applied.
 */
export function proposePlan(errors: readonly LegacyError[], tree: Tree): MigrationPlan {
  const contexts: Record<string, PlannedFactory[]> = {};

  for (const error of errors) {
    const concept = conceptOf(error, aggregatesOf(tree, error.context));

    (contexts[error.context] ??= []).push({
      class: error.className,
      file: error.file,
      code: error.code,
      concept,
      factory: factoryNameFor(error.code, concept),
    });
  }

  return { contexts };
}

function aggregatesOf({ ws, config }: Tree, context: string): string[] {
  return ws
    .list(`${config.contextsDir}/${context}/domain/aggregates`)
    .filter((name) => name.endsWith('.aggregate.ts'))
    .map((name) => toName(name.replace(/\.aggregate\.ts$/, '')).pascal);
}

/** The longest aggregate name the words of the class start or end with. */
function conceptOf(error: LegacyError, aggregates: readonly string[]): string {
  const words = splitWords(error.className.replace(/Error$/, '')).join(' ');

  const named = aggregates
    .filter((aggregate) => {
      const subject = splitWords(aggregate).join(' ');

      return words === subject || words.startsWith(`${subject} `) || words.endsWith(` ${subject}`);
    })
    .sort((a, b) => b.length - a.length);

  return named[0] ?? '';
}
