@@imports
import { {{name.pascal}}Contract } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index{{alias.ext}}';
@@test-bindings
builder.bind({{name.pascal}}Contract).toValue({});
