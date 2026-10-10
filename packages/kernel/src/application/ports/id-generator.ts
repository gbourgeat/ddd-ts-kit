export abstract class IdGenerator {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.IdGenerator' });
  }

  abstract next(): string;
}
