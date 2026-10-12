@@imports
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '{{alias.context}}/{{context.kebab}}.declarations{{alias.ext}}';
{{/if}}
@@contexts
['{{context.kebab}}', {{assembled.proofModule}}],
