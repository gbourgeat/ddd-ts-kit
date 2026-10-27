@@imports
import { {{name.pascal}} } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
import { Simulated{{name.pascal}} } from '{{alias.context}}/infrastructure/external/simulated-{{name.kebab}}.adapter{{alias.ext}}';
@@registrations
builder.bind({{name.pascal}}).toClass(Simulated{{name.pascal}}).as('external');
