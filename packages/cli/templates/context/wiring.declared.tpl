@@imports
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '{{alias.context}}/{{context.kebab}}.declarations.js';
{{/if}}
{{#if http.any}}
import { {{context.camel}}Routes } from '{{alias.context}}/presentation/http/{{context.kebab}}.routes.js';
{{/if}}
@@contexts
{{assembled.module}},
{{#if http.any}}
@@routes
{{context.camel}}Routes,
{{/if}}
