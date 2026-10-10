@@imports
import { {{context.camel}}Module } from '{{paths.platformToContexts}}/{{context.kebab}}/{{context.kebab}}.module.js';
{{#if http.any}}
import { {{context.camel}}Routes } from '{{paths.platformToContexts}}/{{context.kebab}}/presentation/http/{{context.kebab}}.routes.js';
{{/if}}
@@contexts
{{context.camel}}Module,
{{#if http.any}}
@@routes
{{context.camel}}Routes,
{{/if}}
