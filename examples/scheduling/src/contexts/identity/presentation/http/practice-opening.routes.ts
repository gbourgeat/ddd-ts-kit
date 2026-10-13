import { HasRole, RouteGroup } from '@ddd-ts-kit/http';
import { PracticesRoutes } from '@/contexts/identity/presentation/http/practices.routes';
import { Role } from '@/platform/auth/role';

/**
 * Opening a practice is for the operators of the platform: the role is asked at the edge, on
 * top of what every route of the practices asks. The permission `identity:practice.open` still
 * holds on the command, for whoever sends it another way.
 */
@RouteGroup({ parent: PracticesRoutes, guards: [HasRole(Role.PlatformAdmin)] })
export class PracticeOpeningRoutes {}
