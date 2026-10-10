@@imports
import { {{context.camel}}Module } from '{{alias.context}}/{{context.kebab}}.module.js';
{{#if http.any}}
import { {{context.camel}}Routes } from '{{alias.context}}/presentation/http/{{context.kebab}}.routes.js';
{{/if}}
@@contexts
{{context.camel}}Module,
{{#if http.any}}
@@routes
{{context.camel}}Routes,
{{/if}}
