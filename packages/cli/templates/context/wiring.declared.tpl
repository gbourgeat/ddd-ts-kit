@@imports
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '{{alias.context}}/{{context.kebab}}.declarations{{alias.ext}}';
{{/if}}
{{#if routes.listed}}
import { {{context.camel}}Routes } from '{{alias.context}}/presentation/http/{{context.kebab}}.routes{{alias.ext}}';
{{/if}}
@@contexts
{{assembled.module}},
{{#if routes.listed}}
@@routes
{{context.camel}}Routes,
{{/if}}
