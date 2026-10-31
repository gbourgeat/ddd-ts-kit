{{#if http.any}}
import type { ContextModule } from '@ddd-ts-kit/di';
import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless http.any}}
import type { ContextModule } from '@ddd-ts-kit/di';
{{/unless}}

/** The contexts an application hosts: all of them here, one alone in `apps/<context>/main.ts`. */
export interface ContextSelection {
  readonly modules: readonly ContextModule[];
{{#if http.any}}
  /** The function routes of each context, given the two buses they call; controllers need no list. */
  readonly routes?: readonly ((commands: CommandBus, queries: QueryBus) => readonly Route[])[];
{{/if}}
}
