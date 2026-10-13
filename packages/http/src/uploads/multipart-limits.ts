export interface MultipartLimits {
  /** Text fields at most. Default 20. */
  readonly fields?: number;
  /** Bytes of one text field at most. Default 64 KiB. */
  readonly fieldBytes?: number;
}
