export interface AuthenticationStrength {
  /** True when a second factor was verified for this session. */
  readonly mfa?: boolean;
  /** An assurance level in the vocabulary of the identity provider, for example `aal2`. */
  readonly assuranceLevel?: string;
}
