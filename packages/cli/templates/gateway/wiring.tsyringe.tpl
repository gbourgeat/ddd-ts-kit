@@imports
import { {{name.pascal}}Contract } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index{{alias.ext}}';
import { {{name.pascal}}Gateway } from '{{alias.context}}/application/ports/{{name.kebab}}-gateway.port{{alias.ext}}';
import { InProcess{{name.pascal}}Gateway } from '{{alias.context}}/infrastructure/external/in-process-{{name.kebab}}.gateway{{alias.ext}}';
@@registrations
builder.bind({{name.pascal}}Contract).toValue({});
builder.bind({{name.pascal}}Gateway).toClass(InProcess{{name.pascal}}Gateway, [{{name.pascal}}Contract]).as('gateway');
