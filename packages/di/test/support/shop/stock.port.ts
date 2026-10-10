export abstract class Stock {
  abstract reserve(sku: string): Promise<void>;

  abstract reserved(): readonly string[];
}
