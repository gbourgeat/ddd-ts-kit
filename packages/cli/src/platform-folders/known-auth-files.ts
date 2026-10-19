import { AUTH_FOLDERS } from '../platform-auth/index.js';

/** Every file the kit writes in the auth of the platform, whatever its folder. */
export const KNOWN_AUTH_FILES: readonly string[] = Object.values(AUTH_FOLDERS).flat();
