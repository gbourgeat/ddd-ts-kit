import type { Actor } from '@ddd-ts-kit/kernel';
import { sequence } from '../builders/sequence.js';

/** A user of its own at each build, without tenant, role or attribute: `user-1`, `user-2`... */
export const aTestUser = sequence('user', (n): Actor => ({ id: `user-${String(n)}`, type: 'user', roles: [], attributes: {} }));
