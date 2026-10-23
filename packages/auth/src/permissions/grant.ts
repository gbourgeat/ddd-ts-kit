import type { Permission } from './permission';

/** A permission, its id, every permission of a context (`billing:*`) or everything (`*`). */
export type Grant = Permission | string;
