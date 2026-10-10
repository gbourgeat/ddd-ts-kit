@@imports
import { {{name.pascal}}Contract } from '{{paths.platformToContexts}}/{{upstream.kebab}}/published-language/index.js';
@@bindings
builder.bind({{name.pascal}}Contract).toValue({});
