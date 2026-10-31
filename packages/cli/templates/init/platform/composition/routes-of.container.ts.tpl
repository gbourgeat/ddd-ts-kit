{{#if routes.declaredControllers}}
import { DeclaredEdges, type Application as Container } from '@ddd-ts-kit/di';
{{/if}}
{{#unless routes.declaredControllers}}
import type { Application as Container } from '@ddd-ts-kit/di';
{{/unless}}
{{#if routes.mountsControllers}}
import { controllerRoutes, defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
{{#unless routes.mountsControllers}}
import { defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/unless}}
import { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
{{#if audit.functionRoute}}
import { searchAuditEntriesRoute } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.route{{alias.ext}}';
{{/if}}
{{#if audit.controller}}
import { SearchAuditEntriesController } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.controller{{alias.ext}}';
{{/if}}
{{#if routes.mountsControllers}}
import { securitySchemes } from '{{alias.platform}}/auth/authentication/security-schemes{{alias.ext}}';
{{/if}}
import type { ContextSelection } from '{{alias.platform}}/composition/context-selection{{alias.ext}}';

/** Every route of the hosted contexts, and the ones of the platform. */
export function routesOf(container: Container, contexts: ContextSelection): readonly Route[] {
  const commands = container.resolve(CommandBus);
  const queries = container.resolve(QueryBus);

{{#unless routes.mountsControllers}}
  return defineRoutes(...(contexts.routes ?? []).map((routes) => routes(commands, queries)){{#if audit.route}}, [searchAuditEntriesRoute(queries)]{{/if}});
{{/unless}}
{{#if routes.mountsControllers}}
  // Every route that is not public names these schemes in the contract.
  const security = Object.keys(securitySchemes);

  return defineRoutes(
    ...(contexts.routes ?? []).map((routes) => routes(commands, queries)),
{{#if routes.declaredControllers}}
    // The controllers the hosted contexts declare, each built from its constructor.
    controllerRoutes(container.resolve(DeclaredEdges).of('controller'), { resolve: container.resolve, security }),
{{/if}}
{{#if audit.functionRoute}}
    [searchAuditEntriesRoute(queries)],
{{/if}}
{{#if audit.controller}}
    controllerRoutes([new SearchAuditEntriesController(queries)], { security }),
{{/if}}
  );
{{/if}}
}
