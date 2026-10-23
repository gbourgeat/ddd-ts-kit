/** A refusal of the server, answered as the XML error document of S3 with its HTTP status. */
export class S3Error extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  static noSuchBucket(): S3Error {
    return new S3Error(404, 'NoSuchBucket', 'The specified bucket does not exist');
  }

  static noSuchKey(): S3Error {
    return new S3Error(404, 'NoSuchKey', 'The specified key does not exist.');
  }

  static noSuchUpload(): S3Error {
    return new S3Error(404, 'NoSuchUpload', 'The specified multipart upload does not exist.');
  }

  static accessDenied(message: string): S3Error {
    return new S3Error(403, 'AccessDenied', message);
  }

  static signatureDoesNotMatch(): S3Error {
    return new S3Error(
      403,
      'SignatureDoesNotMatch',
      'The request signature we calculated does not match the signature you provided. Check your key and signing method.',
    );
  }

  static invalidRequest(message: string): S3Error {
    return new S3Error(400, 'InvalidRequest', message);
  }

  static notImplemented(what: string): S3Error {
    return new S3Error(501, 'NotImplemented', `${what} is not kept by the in-memory server.`);
  }
}
