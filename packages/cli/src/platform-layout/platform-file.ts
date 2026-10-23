import type { PLATFORM_LAYOUT } from './platform-layout';

type Placed<Files> = Files extends Readonly<Record<string, infer Path>> ? Path : never;

/** A file of the platform the kit gives a folder, by its path from the platform in that folder. */
export type PlatformFile = Placed<(typeof PLATFORM_LAYOUT)[number]['files']>;
