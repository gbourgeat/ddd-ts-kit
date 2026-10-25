import type { RuleDoc } from '../model/rule-doc';

export const NEST_DOCS: Readonly<Record<string, RuleDoc>> = {
  'nest/no-parallel-pipeline': {
    why: 'The routes of the kit are mounted under Nest, not through its pipeline: a guard, a pipe, an exception filter or an interceptor of Nest never sees them, and a controller of Nest written in a context is a route the kit does not see either. Its security is declared nowhere, its refusals are not problem documents with the codes the clients read, and it is missing from the contract. A right checked by a Nest guard is checked on HTTP only, never on /rpc, /trpc, a job or an event handler, which the permission of the use case covers. Each tool of Nest has its place in the kit: the message says which. Nest stays in the platform, for what is not a use case (health, WebSocket gateways, GraphQL), and its WebSocket, GraphQL, microservice and testing packages are not judged. Judged: presentation/, infrastructure/ and the module file of a context, outside its tests; domain/ and application/ already refuse every framework.',
    bad: `// presentation/http/issue-invoice.controller.ts
import { Controller, Post, UseGuards } from '@nestjs/common';
// infrastructure/external/payment-settings.ts
import { ConfigService } from '@nestjs/config';`,
    good: `// presentation/http/invoices/issue-invoice/issue-invoice.controller.ts
import { Controller } from '@ddd-ts-kit/http';

@Controller({ group: InvoicesRoutes, method: 'POST', path: '/', errors: [...] })
export class IssueInvoiceController {}`,
  },
};
