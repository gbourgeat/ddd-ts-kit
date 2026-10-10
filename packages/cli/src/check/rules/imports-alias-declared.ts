import { aliasRoots } from '../../alias/index.js';
import { compilerSettings } from '../alias/compiler-settings.js';
import { configuredAlias } from '../alias/configured-alias.js';
import { graphTools } from '../alias/graph-tools.js';
import type { Inspected } from '../alias/inspected.js';
import { manifestImports } from '../alias/manifest-imports.js';
import { sourceRunners } from '../alias/source-runners.js';
import { testRunners } from '../alias/test-runners.js';
import type { Rule } from '../model/rule.js';
import { reporter } from '../support/reporter.js';

export const importsAliasDeclared: Rule = {
  id: 'imports/alias-declared',
  description:
    'The import alias has one declaration and every tool follows it: "importAlias" is a subpath import, package.json "imports" is exactly what it and tsconfig give, no tsconfig or knip "paths" repeats it, and tsx, the test runner and dependency-cruiser set the source condition.',
  scope: 'project',
  run(project) {
    const inspected: Inspected = { project, roots: aliasRoots(project.config), report: reporter(project, this.id) };
    const unsupported = configuredAlias(inspected);

    if (unsupported.length > 0) {
      return unsupported;
    }

    return [
      ...manifestImports(inspected),
      ...compilerSettings(inspected),
      ...sourceRunners(inspected),
      ...testRunners(inspected),
      ...graphTools(inspected),
    ];
  },
};
