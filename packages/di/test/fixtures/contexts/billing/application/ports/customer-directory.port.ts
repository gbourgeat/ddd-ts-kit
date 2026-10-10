export abstract class CustomerDirectory {
  abstract exists(customerId: string): Promise<boolean>;
}
