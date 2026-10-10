export abstract class Clock {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.Clock' });
  }

  abstract now(): Date;
}
