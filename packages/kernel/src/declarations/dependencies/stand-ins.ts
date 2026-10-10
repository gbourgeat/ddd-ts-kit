/**
 * The classes of a list that can be instantiated and stand where a wider type is expected: an
 * adapter or a fake named in place of the port it implements. A class that is exactly what
 * the parameter asks for (a configuration class) is not one of them.
 */
export type StandIns<Args extends readonly unknown[], List> = {
  [Index in keyof List]: List[Index] extends new (
    ...args: never
  ) => infer Instance
    ? Index extends keyof Args
      ? Args[Index] extends Instance
        ? never
        : List[Index]
      : never
    : never;
}[keyof List & number];
