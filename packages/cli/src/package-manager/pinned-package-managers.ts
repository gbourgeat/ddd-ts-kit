import type { Stack } from '../config';

/**
 * The release `packageManager` pins in package.json, which npm installs for every
 * developer and for the pipeline, and which pnpm then runs. npm comes with Node and is not pinned.
 */
export const PINNED_PACKAGE_MANAGERS: Readonly<Record<Stack['packageManager'], string | undefined>> = {
  npm: undefined,
  pnpm: 'pnpm@12.11.2',
};
