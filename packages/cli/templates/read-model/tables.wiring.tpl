@@imports
import { {{adapter.pascal}} } from '{{alias.context}}/infrastructure/persistence/{{adapter.kebab}}{{alias.ext}}';
@@read-model-tables
['{{context.kebab}}', {{adapter.pascal}}],
