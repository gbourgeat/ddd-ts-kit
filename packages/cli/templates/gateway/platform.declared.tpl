@@imports
import { {{name.constant}}_UPSTREAM } from '{{paths.platformToContexts}}/{{context.kebab}}/application/ports/{{context.kebab}}.ports.js';
@@bindings
builder.bind({{name.constant}}_UPSTREAM).toValue({});
@@test-bindings
builder.bind({{name.constant}}_UPSTREAM).toValue({});
