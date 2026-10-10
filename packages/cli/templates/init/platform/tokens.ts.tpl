import { token } from '@ddd-ts-kit/kernel/declarations';
import type { DatabaseContext } from './database/database.js';

/** The storage of the application, as a repository adapter names it in its dependency list. Bound by the platform module. */
export const DATABASE = token<DatabaseContext>('platform.Database');
