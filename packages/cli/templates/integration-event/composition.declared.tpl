{{#if assembly.discovery}}
@@imports
import { {{publisher.pascal}}Publisher } from '{{paths.platformToContexts}}/{{context.kebab}}/application/integration/publishers/{{publisher.kebab}}.publisher.js';
@@publishers
{{publisher.pascal}}Publisher,
{{/if}}
