@@imports
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '{{paths.architectureToSource}}/contexts/{{context.kebab}}/{{context.kebab}}.declarations.js';
{{/if}}
@@contexts
['{{context.kebab}}', {{assembled.proofModule}}],
