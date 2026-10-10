@@imports
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '{{paths.platformToContexts}}/{{context.kebab}}/{{context.kebab}}.declarations.js';
{{/if}}
{{#if http.any}}
import { {{context.camel}}Routes } from '{{paths.platformToContexts}}/{{context.kebab}}/presentation/http/{{context.kebab}}.routes.js';
{{/if}}
@@contexts
{{assembled.module}},
{{#if http.any}}
@@routes
{{context.camel}}Routes,
{{/if}}
