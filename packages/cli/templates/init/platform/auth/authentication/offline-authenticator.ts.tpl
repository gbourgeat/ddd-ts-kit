import { InvalidCredentialError, type Authenticator } from '@ddd-ts-kit/auth';

/** For tools that compose the application without serving it (contract generation): no credential is accepted. */
export const offlineAuthenticator: Authenticator = {
  authenticate: () => Promise.reject(new InvalidCredentialError('OFFLINE')),
};
