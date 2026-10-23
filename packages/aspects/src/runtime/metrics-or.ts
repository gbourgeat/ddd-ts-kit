import type { Metrics } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime';
import { missingCollaborator } from './missing-collaborator';

export function metricsOr(given: Metrics | undefined): Metrics {
  return given ?? currentRuntime().metrics ?? missingCollaborator('metrics');
}
