/**
 * Takes the fields an instance holds so far out of enumeration: `Object.keys`, a spread and a
 * comparison no longer reach the client or the connection behind them, whose options carry
 * credentials. Called last in a constructor, next to a `toJSON` and an inspection method that
 * answer a name: nothing the instance is shown through leads to what it holds.
 */
export function conceal(instance: object): void {
  for (const field of Object.keys(instance)) {
    Object.defineProperty(instance, field, { enumerable: false });
  }
}
