import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';
import { relationTuples } from '{{alias.platform}}/auth/relation-tuples{{alias.ext}}';

/**
 * What the application does on its own behalf: the relationships of its system actors, one per
 * scheduled job whose command is protected (`generate job` adds it). An integration event
 * handler that sends a protected command needs its line too.
 */
const systemRelationships: readonly RelationTuple[] = [
  // ddd-ts-kit:system-grants
  // /ddd-ts-kit:system-grants
];

/** Written when the application starts, before any job runs; writing a tuple that exists changes nothing. */
export function relateSystemActors(): Promise<void> {
  return relationTuples.write(systemRelationships);
}
