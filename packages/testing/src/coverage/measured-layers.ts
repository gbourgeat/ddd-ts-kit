import type { CoverageLayer } from './coverage-layer';

const INNER: readonly CoverageLayer[] = ['domain', 'application', 'presentation'];
const ADAPTERS: readonly CoverageLayer[] = ['infrastructure'];

/**
 * The layers a run executes, so that it is never failed for one it does not: the unit specs
 * exercise the inner layers (`--mode unit`), the integration specs the adapters
 * (`--mode integration`), and a run of every spec, in any other mode, all four.
 */
export function measuredLayers(mode: string): readonly CoverageLayer[] {
  if (mode === 'unit') {
    return INNER;
  }

  return mode === 'integration' ? ADAPTERS : [...INNER, ...ADAPTERS];
}
