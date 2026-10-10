export abstract class SpotRates {
  abstract rate(pair: string): Promise<number>;
}
