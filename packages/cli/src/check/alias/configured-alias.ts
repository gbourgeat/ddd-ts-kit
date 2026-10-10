import { aliasProblem } from '../../alias/index.js';
import { CONFIG_FILE, DEFAULT_IMPORT_ALIAS } from '../../config/index.js';
import type { Violation } from '../model/violation.js';
import { lineOf } from '../support/line-of.js';
import type { Inspected } from './inspected.js';

/** An alias some tool cannot resolve from package.json alone: nothing else is worth comparing until it is fixed. */
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
      `Set "importAlias" to a subpath import such as "${DEFAULT_IMPORT_ALIAS}", declare it under "imports" in package.json and rewrite the imports (\`eslint --fix\` turns every relative import into its alias).`,
    ),
  ];
}
