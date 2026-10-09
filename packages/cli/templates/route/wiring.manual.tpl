@@imports
import { {{name.camel}}Route } from './presentation/http/{{name.kebab}}.route.js';
@@routes
{{name.camel}}Route(platform.{{route.bus}}),
