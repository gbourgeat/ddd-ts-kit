import type { Cache } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime.js';
import { missingCollaborator } from './missing-collaborator.js';

export function cacheOr(given: Cache | undefined): Cache {
  return given ?? currentRuntime().cache ?? missingCollaborator('cache');
}
