@@imports
import { controllerRoutes } from '@ddd-ts-kit/http';
{{route.wiringImports}}
@@routes
...controllerRoutes([new {{name.pascal}}Controller({{route.platformArguments}}),
