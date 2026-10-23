import { aliasRoots } from '../../alias';
import { buildScripts } from '../alias/build-scripts';
import { compilerPaths } from '../alias/compiler-paths';
import { compilerResolution } from '../alias/compiler-resolution';
import { configuredAlias } from '../alias/configured-alias';
import { graphTools } from '../alias/graph-tools';
import type { Inspected } from '../alias/inspected';
import { sourceRunners } from '../alias/source-runners';
import { testRunners } from '../alias/test-runners';
import type { Rule } from '../model/rule';
import { reporter } from '../support/reporter';

export const importsAliasDeclared: Rule = {
  id: 'imports/alias-declared',
  description:
    'The import alias has one source, "importAlias", and the ending of an import another, "importExtension"; every tool follows them: tsconfig "paths" is exactly what the alias gives, "module" and "moduleResolution" are what the ending needs, vitest and dependency-cruiser read tsconfig, jest repeats the same mapping, no knip "paths" adds another, and the build rewrites the aliases after the compiler.',
  scope: 'project',
  run(project) {
    const inspected: Inspected = { project, roots: aliasRoots(project.config), report: reporter(project, this.id) };
    const unsupported = configuredAlias(inspected);

    if (unsupported.length > 0) {
      return unsupported;
    }

    return [
      ...compilerPaths(inspected),
      ...compilerResolution(inspected),
      ...buildScripts(inspected),
      ...sourceRunners(inspected),
      ...testRunners(inspected),
      ...graphTools(inspected),
    ];
  },
};
