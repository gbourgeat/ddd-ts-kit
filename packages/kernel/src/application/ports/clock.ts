export abstract class Clock {
  static readonly tokenKey = 'kernel.Clock';

  abstract now(): Date;
}
