import { HasRole, RouteGroup } from '@ddd-ts-kit/http';
import { Role } from '@/platform/auth/role';

/**
 * The routes of the audit trail, for the operators of the platform only: the role is asked at
 * the edge, before anything runs, and the permission `audit:trail.read` still holds on the
 * query, for whoever sends it another way.
 */
@RouteGroup({ prefix: '/audit', tags: ['audit'], guards: [HasRole(Role.PlatformAdmin)] })
export class AuditRoutes {}
