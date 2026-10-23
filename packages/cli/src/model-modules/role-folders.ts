import { ROLES } from '../check/canonical/roles.js';
import { MODULE_LAYERS } from './module-layers.js';

/**
 * The folders a role owns directly under each layer a module divides, read from the canonical
 * tree: any other folder directly under `domain/` or `application/` is a module.
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
