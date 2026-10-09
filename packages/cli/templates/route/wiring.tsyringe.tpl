@@imports
import { {{route.busToken}} } from '@ddd-ts-kit/di';
import { {{name.camel}}Route } from './presentation/http/{{name.kebab}}.route.js';
@@routes
{{name.camel}}Route(resolve({{route.busToken}})),
