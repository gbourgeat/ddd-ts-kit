@@imports
import { {{name.pascal}}Contract } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index.js';
@@bindings
builder.bind({{name.pascal}}Contract).toValue({});
