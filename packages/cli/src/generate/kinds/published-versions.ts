import type { Scope } from '../scope';
import { declarationsOf } from './declarations-of';

/** The versions of `eventType` the published language of an upstream declares, oldest first. */
export function publishedVersions(scope: Scope, upstream: string, eventType: string): number[] {
  return declarationsOf(scope, upstream, eventType)
    .map(({ declaration }) => declaration.version)
    .sort((left, right) => left - right);
}
