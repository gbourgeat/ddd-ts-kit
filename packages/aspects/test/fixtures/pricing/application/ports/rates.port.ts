export abstract class Rates {
  abstract rate(pair: string): Promise<number>;
}
