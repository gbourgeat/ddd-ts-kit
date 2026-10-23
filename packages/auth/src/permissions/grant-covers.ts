import { EVERYTHING } from './grant-pattern';
import type { Permission } from './permission';

export function grantCovers(pattern: string, permission: Permission): boolean {
  return pattern === EVERYTHING || pattern === permission.id || pattern === `${permission.context}:*`;
}
