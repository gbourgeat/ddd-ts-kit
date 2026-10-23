import type { Config } from '../config';
import { contextRules } from './context-rules';
import type { CruiseRule } from './cruise-rule';
import { hygieneRules } from './hygiene-rules';
import { layerRules } from './layer-rules';

export interface CruiseConfiguration {
  readonly forbidden: readonly CruiseRule[];
  readonly options: Readonly<Record<string, unknown>>;
}

/**
 * The dependency-cruiser rules of a project, derived from its config: the layer and context
 * boundaries on the resolved import graph, then cycles, orphans and package hygiene. Ported
 * from pipeline/depcruise-config.mjs; a test holds the two to the same output.
 */
export function cruiseConfiguration(config: Config): CruiseConfiguration {
  return {
    forbidden: [...layerRules(config), ...contextRules(config), ...hygieneRules(config)],
    options: cruiseOptions(),
  };
}

/**
 * The parser is the compiler API of `typescript` 6, which the generated project installs for
 * its tools next to the native compiler: it tells type-only imports apart. An import alias is
 * resolved from the `paths` of tsconfig.json, which name the sources: without `tsConfig` the
 * graph would hold an unresolved module for each alias and no boundary rule would see the import.
 * A `generated` directory (the client Prisma writes) is a build product: an import of it is in
 * the graph, what it imports in turn is not the project's to answer for.
 */
function cruiseOptions(): Record<string, unknown> {
  return {
    parser: 'tsc',
    doNotFollow: { path: ['node_modules', '^generated/'] },
    exclude: { path: ['^dist/', '^coverage/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
    reporterOptions: { text: { highlightFocused: true } },
  };
}
