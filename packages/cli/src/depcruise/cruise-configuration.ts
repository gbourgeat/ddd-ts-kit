import { SOURCE_CONDITION } from '../alias/index.js';
import type { Config } from '../config/index.js';
import { contextRules } from './context-rules.js';
import type { CruiseRule } from './cruise-rule.js';
import { hygieneRules } from './hygiene-rules.js';
import { layerRules } from './layer-rules.js';

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
 * resolved from the `imports` of package.json under the source condition: without it the graph
 * would follow the compiled files, which are excluded, and every boundary rule would see nothing.
 */
function cruiseOptions(): Record<string, unknown> {
  return {
    parser: 'tsc',
    doNotFollow: { path: ['node_modules'] },
    exclude: { path: ['^dist/', '^coverage/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: [SOURCE_CONDITION, 'import', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
    reporterOptions: { text: { highlightFocused: true } },
  };
}
