@@imports
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '{{alias.context}}/{{context.kebab}}.declarations.js';
{{/if}}
@@contexts
['{{context.kebab}}', {{assembled.proofModule}}],
