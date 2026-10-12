@@imports
import { {{context.camel}}Module } from '{{alias.context}}/{{context.kebab}}.module{{alias.ext}}';
{{#if http.any}}
import { {{context.camel}}Routes } from '{{alias.context}}/presentation/http/{{context.kebab}}.routes{{alias.ext}}';
{{/if}}
@@contexts
{{context.camel}}Module,
{{#if http.any}}
@@routes
{{context.camel}}Routes,
{{/if}}
