import type { UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{#if http.any}}
import type { Route } from '@ddd-ts-kit/http';
{{/if}}
import type { Platform } from '{{paths.contextToPlatform}}/platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export { {{context.camel}}Permissions } from './application/authorization/{{context.kebab}}.permissions.js';

export interface {{context.pascal}}Wiring {
  readonly name: string;
  readonly useCases: readonly UseCaseDeclaration[];
{{#if http.any}}
  readonly routes: readonly Route[];
{{/if}}
}

export function wire{{context.pascal}}(platform: Platform): {{context.pascal}}Wiring {
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
  };
}
