import { aliasRoots } from '../alias';
import type { Config } from '../config';
import { PLATFORM_LAYOUT, platformFileIn } from '../platform-layout';
import type { Workspace } from '../workspace';
import type { Relocation } from './moved-specifier';

const EXTENSION = /\.ts$/;

/**
 * Where a project generated before the folders keeps each file of the platform: by the path a new
 * project gives it, the flat path, both without extension. Empty for a project whose files are in
 * their folders, which the generators and `init --force` then write where they are.
 */
export function flatRelocation(ws: Workspace, config: Config): Relocation {
  const exists = (path: string): boolean => ws.exists(path);

  const moved = new Map(
    PLATFORM_LAYOUT.flatMap(({ files }) => Object.values(files)).flatMap((file) => {
      const placed = `${config.platformDir}/${file}`;
      const kept = platformFileIn(config, file, exists);

      return kept === placed ? [] : [[placed.replace(EXTENSION, ''), kept.replace(EXTENSION, '')] as const];
    }),
  );

  return { roots: aliasRoots(config), moved };
}
