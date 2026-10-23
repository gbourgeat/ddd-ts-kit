import type { Cache } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime';
import { missingCollaborator } from './missing-collaborator';

export function cacheOr(given: Cache | undefined): Cache {
  return given ?? currentRuntime().cache ?? missingCollaborator('cache');
}
