import { aliasRoots } from '../../alias/index.js';
import { buildScripts } from '../alias/build-scripts.js';
import { compilerPaths } from '../alias/compiler-paths.js';
import { configuredAlias } from '../alias/configured-alias.js';
import { graphTools } from '../alias/graph-tools.js';
import type { Inspected } from '../alias/inspected.js';
import { sourceRunners } from '../alias/source-runners.js';
import { testRunners } from '../alias/test-runners.js';
import type { Rule } from '../model/rule.js';
import { reporter } from '../support/reporter.js';

export const importsAliasDeclared: Rule = {
  id: 'imports/alias-declared',
  description:
    'The import alias has one source, "importAlias", and every tool follows it: tsconfig "paths" is exactly what it gives, vitest and dependency-cruiser read tsconfig, jest repeats the same mapping, no knip "paths" adds another, and the build rewrites the aliases after the compiler.',
  scope: 'project',
  run(project) {
    const inspected: Inspected = { project, roots: aliasRoots(project.config), report: reporter(project, this.id) };
    const unsupported = configuredAlias(inspected);

    if (unsupported.length > 0) {
      return unsupported;
    }

    return [
      ...compilerPaths(inspected),
      ...buildScripts(inspected),
      ...sourceRunners(inspected),
      ...testRunners(inspected),
      ...graphTools(inspected),
    ];
  },
};
