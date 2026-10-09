import { defineContextModule, token } from '@ddd-ts-kit/di';
{{#if http.any}}
import type { Route } from '@ddd-ts-kit/http';
{{/if}}
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export { {{context.camel}}Permissions } from './application/authorization/{{context.kebab}}.permissions.js';

{{#if http.any}}
export const {{context.constant}}_ROUTES = token<readonly Route[]>('{{context.kebab}}.routes');
{{/if}}
// ddd-ts-kit:tokens
// /ddd-ts-kit:tokens

export const {{context.camel}}Module = defineContextModule({
  name: '{{context.kebab}}',
  register(builder) {
    // ddd-ts-kit:registrations
    // /ddd-ts-kit:registrations
{{#if http.any}}
    builder.bind({{context.constant}}_ROUTES).toFactory((resolve) => [
      // ddd-ts-kit:routes
      // /ddd-ts-kit:routes
    ]);
{{/if}}
  },
  onStart({ resolve }) {
    // ddd-ts-kit:start
    // /ddd-ts-kit:start
  },
});
