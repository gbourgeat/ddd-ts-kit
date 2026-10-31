@@imports
import { {{name.pascal}}Projection } from '{{alias.context}}/application/projections/{{name.kebab}}.projection{{alias.ext}}';
@@registrations
builder.include({{name.pascal}}Projection);
