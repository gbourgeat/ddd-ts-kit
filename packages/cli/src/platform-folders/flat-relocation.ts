import { aliasRoots } from '../alias/index.js';
import type { Config } from '../config/index.js';
import { AUTH_FOLDERS, authFileIn, authPathOf } from '../platform-auth/index.js';
import type { Workspace } from '../workspace/index.js';
import type { Relocation } from './moved-specifier.js';

const EXTENSION = /\.ts$/;

/**
 * Where a project generated before the folders keeps each file of the auth of the platform: by
 * the path a new project gives it, the flat path, both without extension. Empty for a project
 * whose files are in their folders, which `init --force` then writes where they are.
 */
export function flatRelocation(ws: Workspace, config: Config): Relocation {
  const exists = (path: string): boolean => ws.exists(path);

  const moved = new Map(
    Object.values(AUTH_FOLDERS)
      .flat()
      .flatMap((name) => {
        const placed = `${config.platformDir}/${authPathOf(name)}`;
        const kept = authFileIn(config, name, exists);

        return kept === placed ? [] : [[placed.replace(EXTENSION, ''), kept.replace(EXTENSION, '')] as const];
      }),
  );

  return { roots: aliasRoots(config), moved };
}
