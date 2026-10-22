import type { Resolution } from '../merge/resolution';

/** What merging one branch into another would leave now, computed without touching a working tree. */
export interface MergeForecast {
  /** The branch merged in: the trunk, or the branch of another story. */
  readonly ref: string;
  /** The commits of `ref` the branch it is merged into does not hold. */
  readonly behind: number;
  /** The conflicted paths `merge-trunk` settles: derived files, rows of slices.md, registries, the lockfile. */
  readonly settled: readonly ForecastPath[];
  /** The conflicted paths left to a person. */
  readonly byHand: readonly ForecastPath[];
}

/** One conflicted path of a forecast, relative to the top of the repository, with its class. */
export interface ForecastPath {
  readonly file: string;
  readonly kind: Resolution['kind'];
}
