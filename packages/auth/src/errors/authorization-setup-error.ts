/** Permissions, roles, policies or declarations that contradict themselves, found when they are defined. */
export class AuthorizationSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationSetupError';
  }
}
