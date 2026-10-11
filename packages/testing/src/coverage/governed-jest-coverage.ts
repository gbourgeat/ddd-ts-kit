import type { CoverageRates } from './coverage-rates.js';
import { governedSettings } from './governed-settings.js';
import { heldLayers } from './held-layers.js';
import { measuredFiles } from './measured-files.js';
import { measuredLayers } from './measured-layers.js';

/** The part of a Jest config that the config file of a project governs. */
export interface GovernedJestCoverage {
  readonly collectCoverageFrom: string[];
  /** One directory per context and layer that holds a source file: Jest sums the files under a directory. */
  readonly coverageThreshold: Record<string, CoverageRates>;
}

/**
 * The same as `governedCoverage`, in the options of Jest, which runs every spec in one run: the
 * four layers of every context are measured and held to the `coverage` key of
 * `ddd-ts-kit.config.json`.
 *
 *     // jest.config.js
 *     import { governedJestCoverage } from '@ddd-ts-kit/testing/coverage';
 *     export default { coverageProvider: 'v8', ...governedJestCoverage() };
 */
export function governedJestCoverage(root: string = process.cwd()): GovernedJestCoverage {
  const { contextsDir, thresholds } = governedSettings(root);
  const layers = measuredLayers('all');
  const held = heldLayers(root, contextsDir, layers);

  return {
    collectCoverageFrom: measuredFiles(contextsDir, layers).map((files) => `<rootDir>/${files}`),
    coverageThreshold: Object.fromEntries(
      held.map(({ layer, directory }) => [`./${directory}/`, { ...thresholds[layer] }]),
    ),
  };
}
