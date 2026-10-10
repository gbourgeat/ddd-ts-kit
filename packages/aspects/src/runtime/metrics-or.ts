import type { Metrics } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime.js';
import { missingCollaborator } from './missing-collaborator.js';

export function metricsOr(given: Metrics | undefined): Metrics {
  return given ?? currentRuntime().metrics ?? missingCollaborator('metrics');
}
