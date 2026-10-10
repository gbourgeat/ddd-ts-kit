export abstract class IdGenerator {
  static readonly tokenKey = 'kernel.IdGenerator';

  abstract next(): string;
}
