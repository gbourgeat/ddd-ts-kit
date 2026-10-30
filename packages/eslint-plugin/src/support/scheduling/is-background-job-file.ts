import type { ContextLocation } from '../../project/location';

/** `application/background/*.background-job.ts` of a context, or of a module of its model: the one place a background job lives. */
export function isBackgroundJobFile(path: string, location: ContextLocation): boolean {
  return location.layer === 'application' && location.inside[0] === 'background' && path.endsWith('.background-job.ts');
}
