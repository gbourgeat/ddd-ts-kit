/** The Nest provider `provideControllers` registers: it hands the routes their instances when Nest initialises it. */
export abstract class ControllersBinder {
  static readonly tokenKey = 'http.ControllersBinder';

  abstract onModuleInit(): void;
}
