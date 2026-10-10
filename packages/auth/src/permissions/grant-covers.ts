import { EVERYTHING } from './grant-pattern.js';
import type { Permission } from './permission.js';

export function grantCovers(pattern: string, permission: Permission): boolean {
  return pattern === EVERYTHING || pattern === permission.id || pattern === `${permission.context}:*`;
}
