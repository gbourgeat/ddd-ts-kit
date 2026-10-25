/**
 * A strategy of Passport as the bridge runs it: `authenticate`, called with the request, answers
 * through the actions Passport gives a strategy (`success`, `fail`, `error`, `pass`, `redirect`).
 * A strategy of `passport-jwt` or `passport-http-bearer`, and an instance of a class built with
 * `PassportStrategy` of `@nestjs/passport`, are ones.
 */
export interface PassportStrategyLike {
  readonly authenticate: (...args: never[]) => unknown;
}
