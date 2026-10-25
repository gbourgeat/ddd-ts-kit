import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { KitRouteSpec } from './kit-route-spec';
import { nestRoutesRegistry } from './nest-routes-registry';

/**
 * Makes a method of a Nest controller a route of the kit, next to Nest's own decorators:
 *
 *     @Controller('invoices')
 *     export class InvoicesController {
 *       constructor(private readonly commands: CommandBus) {}
 *
 *       @Post(':invoiceId/issue')
 *       @KitRoute({ operationId: 'issueInvoice', summary: 'Issue an invoice', guards: [Authenticated], errors: ['INVOICE_ALREADY_ISSUED'] })
 *       issue(@Param('invoiceId') invoiceId: string, @Body() body: IssueInvoiceBody, @CurrentActor() actor: Actor) { ... }
 *     }
 *
 * The kit serves the route, not Nest's router: its guards, validation, error mapping, tracing and
 * contract are those of every route of the kit (`createControllersModule`, `nestControllerRoutes`).
 */
export function KitRoute(spec: KitRouteSpec): (target: object, method: string | symbol) => void {
  return (target, method) => {
    if (typeof method !== 'string') {
      throw new DeclarationError('@KitRoute goes on a method named by a string.');
    }

    const { routes } = nestRoutesRegistry();
    const declared = routes.get(target) ?? new Map<string, KitRouteSpec>();

    declared.set(method, spec);
    routes.set(target, declared);
  };
}
