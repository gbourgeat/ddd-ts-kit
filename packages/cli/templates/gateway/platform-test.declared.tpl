@@imports
import { {{name.pascal}}Contract } from '{{paths.platformToContexts}}/{{upstream.kebab}}/published-language/index.js';
@@test-bindings
builder.bind({{name.pascal}}Contract).toValue({});
