import type { RuleDoc } from '../model/rule-doc';

export const NEST_DOCS: Readonly<Record<string, RuleDoc>> = {
  'nest/no-parallel-pipeline': {
    why: 'The routes of the kit are mounted under Nest, not through its pipeline: a guard, a pipe, an exception filter or an interceptor of Nest never sees them, and a controller of Nest written in a context is a route the kit does not see either. Its security is declared nowhere, its refusals are not problem documents with the codes the clients read, and it is missing from the contract. A right checked by a Nest guard is checked on HTTP only, never on /rpc, /trpc, a job or an event handler, which the permission of the use case covers. A Nest controller the kit serves is the exception: with `@KitRoute` of `@ddd-ts-kit/http/nest` on its methods, its routes are declared with the decorators of Nest (`@Controller`, `@Post`, `@Body`, `@Param`...) and served by the pipeline of the kit, and the raw request, the guards, pipes, filters and interceptors of Nest stay refused there. Outside the contexts, a controller Nest serves that reaches a use case (it names `CommandBus` or `QueryBus`, or imports a file of a context) is refused too: moving it to the platform would keep the hole. Each tool of Nest has its place in the kit: the message says which. Nest stays in the platform, for what is not a use case (health, WebSocket gateways, GraphQL), and its WebSocket, GraphQL, microservice and testing packages are not judged. Judged: presentation/, infrastructure/ and the module file of a context, outside its tests; domain/ and application/ already refuse every framework.',
    bad: `// presentation/http/issue-invoice.controller.ts
import { Controller, Post, UseGuards } from '@nestjs/common';
// infrastructure/external/payment-settings.ts
import { ConfigService } from '@nestjs/config';`,
    good: `// presentation/http/invoices.controller.ts
import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';

@Controller('invoices')
@KitRoutes({ guards: [Authenticated] })
export class InvoicesController {
  @Post(':invoiceId/issue')
  @KitRoute({ operationId: 'issueInvoice', summary: 'Issue an invoice', errors: ['INVOICE_ALREADY_ISSUED'] })
  issue(@Param('invoiceId') invoiceId: string, @Body() body: IssueInvoiceBody, @CurrentActor() actor: Actor) {}
}`,
  },
};
