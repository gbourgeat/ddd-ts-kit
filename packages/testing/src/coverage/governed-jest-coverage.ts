import type { CoverageRates } from './coverage-rates';
import { generatedDeclarations } from './generated-declarations';
import { portFiles } from './port-files';
import { governedSettings } from './governed-settings';
import { heldLayers } from './held-layers';
import { layerFolders } from './layer-folders';
import { measuredFiles } from './measured-files';
import { measuredLayers } from './measured-layers';
import { typeOnlyFiles } from './type-only-files';

/** The part of a Jest config that the config file of a project governs. */
export interface GovernedJestCoverage {
  readonly collectCoverageFrom: string[];
  /** One directory per context and layer that holds a source file: Jest sums the files under a directory. */
  readonly coverageThreshold: Record<string, CoverageRates>;
}

/**
 * The same as `governedCoverage`, in the options of Jest, which runs every spec in one run: the
 * four layers of every context are measured and held to the `coverage` key of
 * `ddd-ts-kit.config.json`. A file of types only is left out: Jest with `v8` reports all its lines
 * uncovered, as no spec loads it (Vitest skips it as an empty file).
 *
 *     // jest.config.js
 *     import { governedJestCoverage } from '@ddd-ts-kit/testing/coverage';
 *     export default { coverageProvider: 'babel', ...governedJestCoverage() };
 */
export function governedJestCoverage(root: string = process.cwd()): GovernedJestCoverage {
  const { contextsDir, thresholds } = governedSettings(root);
  const layers = measuredLayers('all');
  const held = heldLayers(root, contextsDir, layers);

  return {
    collectCoverageFrom: [
      ...measuredFiles(contextsDir, layers).map((files) => `<rootDir>/${files}`),
      `!<rootDir>/${generatedDeclarations(contextsDir)}`,
      ...portFiles(contextsDir).map((files) => `!<rootDir>/${files}`),
      ...typeOnlyFiles(
        root,
        layerFolders(root, contextsDir, layers).map(({ directory }) => directory),
      ).map((file) => `!<rootDir>/${file}`),
    ],
    coverageThreshold: Object.fromEntries(
      held.map(({ layer, directory }) => [`./${directory}/`, { ...thresholds[layer] }]),
    ),
  };
}
