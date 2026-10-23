import { aliasProblem } from '../../alias';
import { CONFIG_FILE, DEFAULT_IMPORT_ALIAS } from '../../config';
import type { Violation } from '../model/violation';
import { lineOf } from '../support/line-of';
import type { Inspected } from './inspected';

/** An alias the kit cannot hold every tool to: nothing else is worth comparing until it is fixed. */
export function configuredAlias({ project, report }: Inspected): Violation[] {
  const { importAlias } = project.config;
  const problem = aliasProblem(importAlias);

  if (problem === undefined) {
    return [];
  }

  return [
    report(
      { file: CONFIG_FILE, line: lineOf(project.configText, '"importAlias"') },
      `"importAlias" is "${importAlias}", which is not supported: ${problem}.`,
      `Set "importAlias" to "${DEFAULT_IMPORT_ALIAS}" or to "$<name>/", write it under "paths" in tsconfig.json and rewrite the imports (\`eslint --fix\` turns every relative import into its alias).`,
    ),
  ];
}
