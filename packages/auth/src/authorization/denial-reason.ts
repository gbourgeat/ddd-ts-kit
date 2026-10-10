/** The reasons the authorizers of this package give. An adapter may add its own. */
export const DenialReason = {
  anonymous: 'ANONYMOUS',
  noMatchingRole: 'NO_MATCHING_ROLE',
  tenantMismatch: 'TENANT_MISMATCH',
  explicitDeny: 'EXPLICIT_DENY',
  noMatchingPolicy: 'NO_MATCHING_POLICY',
  subjectMismatch: 'SUBJECT_MISMATCH',
  resourceRequired: 'RESOURCE_REQUIRED',
  unmappedPermission: 'UNMAPPED_PERMISSION',
  noRelation: 'NO_RELATION',
  depthExceeded: 'DEPTH_EXCEEDED',
} as const;
