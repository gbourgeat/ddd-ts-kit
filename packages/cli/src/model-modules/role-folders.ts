import { ROLES } from '../check/canonical/roles';
import { MODULE_LAYERS } from './module-layers';

/**
 * The folders a role owns directly under each layer a module holds, read from the canonical tree:
 * a folder of 0.86 and 0.87 directly under `domain/` or `application/` that none owns is a module.
 */
export const ROLE_FOLDERS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  MODULE_LAYERS.map((layer) => [
    layer,
    [
      ...new Set(
        ROLES.map((role) => role.directory.split('/'))
          .filter(([top]) => top === layer)
          .map(([, folder = '']) => folder),
      ),
    ],
  ]),
);
