import { fileURLToPath } from 'node:url';

/** `templates/` sits next to both `src/` (tests) and `dist/` (published package). */
export const TEMPLATES_ROOT = fileURLToPath(new URL('../../templates/', import.meta.url));
