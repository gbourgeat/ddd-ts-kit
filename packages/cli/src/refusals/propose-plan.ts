import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { aggregatesOf } from './aggregates-of.js';
import { conceptNamed } from './concept-named.js';
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
    const concept = conceptNamed(error.className, aggregatesOf(tree, error.context));

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
