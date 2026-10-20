import type { CoverageRates } from './coverage-rates.js';
import { generatedDeclarations } from './generated-declarations.js';
import { measuredFiles } from './measured-files.js';
import { governedSettings } from './governed-settings.js';
import { heldLayers } from './held-layers.js';
import { measuredLayers } from './measured-layers.js';

/** The part of the `coverage` options of Vitest that the config file of a project governs. */
export interface GovernedCoverage {
  /** The measured layers of every context, the files no spec loads included. */
  readonly include: string[];
  /** The generated declarations of the role folders, which no spec has to load. */
  readonly exclude: string[];
  /** One entry per context and layer that holds a source file: a context cannot hide behind another. */
  readonly thresholds: Record<string, CoverageRates>;
}

/**
 * What a Vitest run measures and the floor it is held to, read from the `coverage` key of
 * `ddd-ts-kit.config.json` (the reference when the key is absent): the one place a threshold is
 * written. `mode` is the mode of the run: `unit` measures domain, application and presentation,
 * `integration` measures infrastructure, any other mode measures the four layers. A partial run
 * (`DDD_TS_KIT_AFFECTED`) measures and holds the contexts it names, and no other.
 *
 *     // vitest.config.ts
 *     import { governedCoverage } from '@ddd-ts-kit/testing/coverage';
 *     export default defineConfig(({ mode }) => ({
 *       test: { coverage: { provider: 'v8', ...governedCoverage(mode) } },
 *     }));
 */
export function governedCoverage(mode: string, root: string = process.cwd()): GovernedCoverage {
  const { contextsDir, thresholds } = governedSettings(root);
  const layers = measuredLayers(mode);
  const held = heldLayers(root, contextsDir, layers);

  return {
    include: measuredFiles(contextsDir, layers),
    exclude: [generatedDeclarations(contextsDir)],
    thresholds: Object.fromEntries(
      held.map(({ layer, directory }) => [`${directory}/**/*.ts`, { ...thresholds[layer] }]),
    ),
  };
}
