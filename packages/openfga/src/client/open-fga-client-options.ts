export interface OpenFgaClientOptions {
  /** `http://localhost:8080`. */
  readonly apiUrl: string;
  readonly storeId: string;
  /** Pin a model; left out, every check uses the latest model of the store. */
  readonly authorizationModelId?: string;
  /** A preshared key, when the server asks for one. Read from configuration, never written in code. */
  readonly apiToken?: string;
}
