@@imports
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '{{alias.context}}/{{context.kebab}}.declarations{{alias.ext}}';
{{/if}}
{{#if http.any}}
import { {{context.camel}}Routes } from '{{alias.context}}/presentation/http/{{context.kebab}}.routes{{alias.ext}}';
{{/if}}
@@contexts
{{assembled.module}},
{{#if http.any}}
@@routes
{{context.camel}}Routes,
{{/if}}
