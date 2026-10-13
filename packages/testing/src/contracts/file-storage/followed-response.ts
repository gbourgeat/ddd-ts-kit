/** What a signed link answered; header names in lower case. */
export interface FollowedResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}
