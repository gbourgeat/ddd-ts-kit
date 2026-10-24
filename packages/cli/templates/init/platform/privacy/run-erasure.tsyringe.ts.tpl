import type { Application as Container } from '@ddd-ts-kit/di';
import {
  ExecutionScope,
  SubjectKeyStore,
  eraseDataSubject,
  executionContext,
{{#if tenancy.any}}
  inEachTenant,
{{/if}}
  type Actor,
  type DataSubjectErasureReport,
} from '@ddd-ts-kit/kernel';
import { dataSubjectCopies } from '{{alias.platform}}/privacy/data-subject-copies{{alias.ext}}';

export interface ErasureRequest {
  /** The composed application: the keys and the copies are resolved from it. */
  readonly container: Container;
  /** Who asks for the erasure, as typed: the actor of the work{{#if audit.on}}, named by the entry the audited keys write{{/if}}. */
  readonly operator: string;
  /** The correlation of the work: one per erasure. */
  readonly correlationId: string;
{{#if tenancy.any}}
  /** The tenants the deployment serves: the copies are erased in each one, in an execution context of that tenant, since a write of tenant data is never widened. */
  readonly tenants: readonly string[];
{{/if}}
}

/**
 * The right to erasure of one data subject, in an execution context of its own (origin `cli`): the
 * key first{{#if audit.on}}, with its audit entry{{/if}}, then every copy a context declared in `data-subject-copies.ts`{{#if tenancy.any}}, in
 * every tenant{{/if}}. Running it again completes an erasure whose entry or copy failed; a subject that is
 * not an opaque identifier is refused before any key is touched.
 */
export function runErasure(subject: string, request: ErasureRequest): Promise<DataSubjectErasureReport> {
  const { container, operator, correlationId } = request;
  const scope = container.resolve(ExecutionScope);
  const context = executionContext({ correlationId, actor: operatorActor(operator), origin: 'cli' });

  return scope.run(context, () =>
    eraseDataSubject(subject, {
      // TODO(platform): once a projection is fed by the event store, give `rebuilds` the rebuild of each one: a projection keeps a clear copy of the person until it is rebuilt.
      keys: container.resolve(SubjectKeyStore),
      copies: dataSubjectCopies.map((copy) => container.resolve(copy)),
{{#if tenancy.any}}
      inEveryTenant: inEachTenant(scope, request.tenants),
{{/if}}
    }),
  );
}

function operatorActor(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}
