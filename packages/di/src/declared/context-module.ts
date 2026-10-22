import type { ContextModule } from '../module/context-module';
import { defineContextModule } from '../module/define-context-module';
import type { DeclaredSource } from './declared-source';

/**
 * The module of a bounded context made of classes that declare themselves:
 * `contextModule('billing', [IssueInvoice, IssueInvoiceHandler, KnexInvoiceRepository])`, or
 * `contextModule('billing', billing)` with `import * as billing from './billing.declarations.js'`.
 * Fully static: a bundler and a dead-code analysis follow every class.
 */
export function contextModule(name: string, declared: DeclaredSource): ContextModule {
  return defineContextModule({
    name,
    register(builder) {
      builder.include(declared);
    },
  });
}
