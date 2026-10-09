{{#if http.any}}
import type { Route } from '@ddd-ts-kit/http';
{{/if}}
import type { Platform } from '{{paths.contextToPlatform}}/platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface {{context.pascal}}Wiring {
  readonly name: string;
{{#if http.any}}
  readonly routes: readonly Route[];
{{/if}}
}

export function wire{{context.pascal}}(platform: Platform): {{context.pascal}}Wiring {
  // ddd-ts-kit:registrations
  // /ddd-ts-kit:registrations
  return {
    name: '{{context.kebab}}',
{{#if http.any}}
    routes: [
      // ddd-ts-kit:routes
      // /ddd-ts-kit:routes
    ],
{{/if}}
  };
}
