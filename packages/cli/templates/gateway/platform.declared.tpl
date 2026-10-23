@@imports
import { {{name.pascal}}Contract } from '{{alias.contexts}}/{{upstream.kebab}}/published-language{{alias.index}}';
@@bindings
builder.bind({{name.pascal}}Contract).toValue({});
