import type { Name } from '../../../naming';

/** The group a controller stands in: where it is written, and the prefix its groups put before the path. */
export interface RouteGroup {
  readonly name: Name;
  /** Its file inside the context, without extension. */
  readonly file: string;
  /** The prefixes of its parents and its own, joined: empty at the root. */
  readonly prefix: string;
  readonly exists: boolean;
}
