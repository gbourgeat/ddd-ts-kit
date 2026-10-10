import type { Logger } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime.js';
import { missingCollaborator } from './missing-collaborator.js';

export function loggerOr(given: Logger | undefined): Logger {
  return given ?? currentRuntime().logger ?? missingCollaborator('logger');
}
