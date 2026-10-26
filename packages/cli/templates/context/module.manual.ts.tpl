import type { UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{#if routes.nest}}
import type { Type } from '@nestjs/common';
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';
{{/if}}
{{#if http.any}}
import type { Route } from '@ddd-ts-kit/http';
{{/if}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface {{context.pascal}}Wiring {
  readonly name: string;
  readonly useCases: readonly UseCaseDeclaration[];
  {{#if http.any}}
  readonly routes: readonly Route[];
  {{/if}}
  {{#if routes.nest}}
  /** Its Nest controllers, listed by the generated `{{context.kebab}}.controllers.ts`: Nest builds them, the kit serves their methods. */
  readonly controllers: readonly Type<unknown>[];
  {{/if}}
}

export function {{context.camel}}Module(platform: Platform): {{context.pascal}}Wiring {
  registerHandlers(platform);
  registerReactions(platform);
  registerJobs(platform);

  return {
    name: '{{context.kebab}}',
    useCases: declaredUseCases(),
    {{#if http.any}}
    routes: routesOf(platform),
    {{/if}}
    {{#if routes.nest}}
    controllers: {{context.camel}}Controllers,
    {{/if}}
  };
}

/** The command and query handlers of the context, with the repositories and readers they are given. */
function registerHandlers(platform: Platform): void {
  // ddd-ts-kit:handlers
  // /ddd-ts-kit:handlers
}

/** What the context does when an event happens: its own events and those of the other contexts. */
function registerReactions(platform: Platform): void {
  // ddd-ts-kit:reactions
  // /ddd-ts-kit:reactions
}

/** The jobs of the context, scheduled and in the background. */
function registerJobs(platform: Platform): void {
  // ddd-ts-kit:jobs
  // /ddd-ts-kit:jobs
}

/** What each use case requires, or that it is public. */
function declaredUseCases(): UseCaseDeclaration[] {
  return [
    // ddd-ts-kit:authorization
    // /ddd-ts-kit:authorization
  ];
}
{{#if http.any}}

/** The routes the context answers, over the buses of the platform. */
function routesOf(platform: Platform): Route[] {
  return [
    // ddd-ts-kit:routes
    // /ddd-ts-kit:routes
  ];
}
{{/if}}
