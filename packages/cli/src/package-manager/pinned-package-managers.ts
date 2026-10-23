import type { Stack } from '../config';

/**
 * The release `packageManager` pins in package.json, which corepack then provides to every
 * developer and to the pipeline. npm comes with Node and is not pinned.
 */
export const PINNED_PACKAGE_MANAGERS: Readonly<Record<Stack['packageManager'], string | undefined>> = {
  npm: undefined,
  pnpm: 'pnpm@12.11.2',
};
