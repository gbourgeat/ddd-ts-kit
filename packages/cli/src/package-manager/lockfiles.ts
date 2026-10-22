import type { Stack } from '../config';

/** The lockfile each package manager writes: what a cache of the installed dependencies is keyed on. */
export const LOCKFILES: Readonly<Record<Stack['packageManager'], string>> = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
};

/** The copy of the lockfile each package manager writes under node_modules once an install ends: when it last installed. */
export const INSTALLED_LOCKFILES: Readonly<Record<Stack['packageManager'], string>> = {
  npm: 'node_modules/.package-lock.json',
  pnpm: 'node_modules/.pnpm/lock.yaml',
};
