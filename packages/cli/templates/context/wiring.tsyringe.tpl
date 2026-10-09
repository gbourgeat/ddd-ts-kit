@@imports
{{#if http.any}}
import { {{context.constant}}_ROUTES, {{context.camel}}Module } from '{{paths.platformToContexts}}/{{context.kebab}}/{{context.kebab}}.module.js';
{{/if}}
{{#unless http.any}}
import { {{context.camel}}Module } from '{{paths.platformToContexts}}/{{context.kebab}}/{{context.kebab}}.module.js';
{{/unless}}
@@contexts
{{context.camel}}Module,
{{#if http.any}}
@@routes
{{context.constant}}_ROUTES,
{{/if}}
