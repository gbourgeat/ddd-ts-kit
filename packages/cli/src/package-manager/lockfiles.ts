import type { Stack } from '../config/index.js';

/** The lockfile each package manager writes: what a cache of the installed dependencies is keyed on. */
export const LOCKFILES: Readonly<Record<Stack['packageManager'], string>> = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
};
