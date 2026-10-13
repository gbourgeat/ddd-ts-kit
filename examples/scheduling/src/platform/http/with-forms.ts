import { defineRoutes, formRoutes, type Route } from '@ddd-ts-kit/http';
import type { Presentation } from '@/platform/http/presentation-of';

/** The routes, and the form of each one that declares `form`, at `GET /forms/<operationId>`, for the caller who asks. */
export function withForms(routes: readonly Route[], { fieldAccess }: Presentation): readonly Route[] {
  return defineRoutes(routes, formRoutes(routes, { fieldAccess }));
}
