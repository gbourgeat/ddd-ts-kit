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
  // ddd-ts-kit:registrations
  // /ddd-ts-kit:registrations

  return {
    name: '{{context.kebab}}',
    useCases: [
      // ddd-ts-kit:authorization
      // /ddd-ts-kit:authorization
    ],
    {{#if http.any}}
    routes: [
      // ddd-ts-kit:routes
      // /ddd-ts-kit:routes
    ],
    {{/if}}
    {{#if routes.nest}}
    controllers: {{context.camel}}Controllers,
    {{/if}}
  };
}
