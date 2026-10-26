/**
 * Where each file of the platform that a version before the folders wrote flat lives now, both
 * relative to the platform, in groups: a project still holding the anchor of a group flat keeps
 * every file of that group flat, the ones it writes later included.
 */
export const PLATFORM_LAYOUT = [
  {
    anchor: 'auth/create-authorizer.ts',
    files: {
      'auth/create-authenticator.ts': 'auth/authentication/create-authenticator.ts',
      'auth/principal-of.ts': 'auth/authentication/principal-of.ts',
      'auth/security-schemes.ts': 'auth/authentication/security-schemes.ts',
      'auth/http-boundary.ts': 'auth/authentication/http-boundary.ts',
      'auth/offline-authenticator.ts': 'auth/authentication/offline-authenticator.ts',
      'auth/bearer-strategy.ts': 'auth/authentication/bearer-strategy.ts',
      'auth/actor-of-token.ts': 'auth/authentication/actor-of-token.ts',
      'auth/development-actor-header.ts': 'auth/authentication/development-actor-header.ts',
      'auth/development-header-authenticator.ts': 'auth/authentication/development-header-authenticator.ts',
      'auth/authorization.ts': 'auth/authorization/authorization.ts',
      'auth/use-case-protection.ts': 'auth/authorization/use-case-protection.ts',
      'auth/create-authorizer.ts': 'auth/authorization/create-authorizer.ts',
      'auth/access-policies.ts': 'auth/authorization/access-policies.ts',
      'auth/permissions.ts': 'auth/authorization/permissions.ts',
      'auth/signed-in-grants.ts': 'auth/authorization/signed-in-grants.ts',
      'auth/log-decisions.ts': 'auth/authorization/log-decisions.ts',
      'auth/role.ts': 'auth/authorization/role.ts',
      'auth/roles.ts': 'auth/roles/roles.ts',
      'auth/attribute-policies.ts': 'auth/attributes/attribute-policies.ts',
      'auth/relationship-schema.ts': 'auth/relationships/relationship-schema.ts',
      'auth/relation-tuples.ts': 'auth/relationships/relation-tuples.ts',
      'auth/create-tuple-store.ts': 'auth/relationships/create-tuple-store.ts',
      'auth/create-tuple-store.contract.spec.ts': 'auth/relationships/create-tuple-store.contract.spec.ts',
      'auth/relate-system-actors.ts': 'auth/relationships/relate-system-actors.ts',
      'auth/custom-authorizer.ts': 'auth/custom/custom-authorizer.ts',
      'auth/custom-authorizer.contract.spec.ts': 'auth/custom/custom-authorizer.contract.spec.ts',
    },
  },
  {
    anchor: 'compose-application.ts',
    files: {
      'compose-application.ts': 'composition/compose-application.ts',
      'platform.module.ts': 'composition/platform.module.ts',
      'platform-test.module.ts': 'composition/platform-test.module.ts',
      'platform-error-mapper.ts': 'composition/platform-error-mapper.ts',
      'lay-foundations.ts': 'composition/lay-foundations.ts',
      'platform.ts': 'composition/platform.ts',
      'create-platform.ts': 'composition/create-platform.ts',
      'tracing.ts': 'observability/tracing.ts',
      'errors.ts': 'observability/errors.ts',
      'job-settings.ts': 'jobs/job-settings.ts',
      'background-jobs.ts': 'jobs/background-jobs.ts',
      'create-background-work.ts': 'jobs/create-background-work.ts',
    },
  },
  {
    anchor: 'audit/search-audit-entries.handler.ts',
    files: {
      'audit/search-audit-entries.query.ts': 'audit/search-audit-entries/search-audit-entries.query.ts',
      'audit/search-audit-entries.handler.ts': 'audit/search-audit-entries/search-audit-entries.handler.ts',
      'audit/search-audit-entries.controller.ts': 'audit/search-audit-entries/search-audit-entries.controller.ts',
      'audit/search-audit-entries.route.ts': 'audit/search-audit-entries/search-audit-entries.route.ts',
      'audit/audit-outcomes.ts': 'audit/search-audit-entries/audit-outcomes.ts',
      'audit/audit-entries-parameters.ts': 'audit/search-audit-entries/audit-entries-parameters.ts',
      'audit/audit-entries-filter-of.ts': 'audit/search-audit-entries/audit-entries-filter-of.ts',
      'audit/audit-entry-view.ts': 'audit/search-audit-entries/audit-entry-view.ts',
      'audit/audit-entry-view-of.ts': 'audit/search-audit-entries/audit-entry-view-of.ts',
    },
  },
] as const;
