import ky from 'ky';

/**
 * Create an instance of Ky with options shared by all requests.
 */
export function createApiInstance(opts: { apiKey: string; baseUrl: string }) {
  return ky.extend({
    prefixUrl: opts.baseUrl,
    headers: {
      'Api-Key': opts.apiKey,
    },
    hooks: {
      beforeError: [
        // @ts-ignore
        async (error) => {
          const { response } = error;
          if (response && response.body) {
            try {
              const body = await response.clone().json();
              if (body.message) {
                return new PineconeError(body.message, {
                  code: body.code,
                  details: body.details,
                  status: response.status,
                  cause: error,
                });
              }
            } catch (e) {
              console.error('Failed reading HTTPError response body', e);
            }
          }
          return error;
        },
      ],
    },
  });
}

type PineconeErrorDetail = { typeUrl: string; value: string };

export class PineconeError extends Error {
  public code: number;
  public details?: PineconeErrorDetail[];
  public status: number;

  constructor(
    message: string,
    opts: {
      cause?: Error;
      code: number;
      details?: PineconeErrorDetail[];
      status: number;
    }
  ) {
    if (opts.cause) {
      // @ts-ignore not sure why TS can't handle this
      super(message, { cause: opts.cause });
    } else {
      super(message);
    }

    // Ensure the name of this error is the same as the class name
    this.name = this.constructor.name;

    // Set stack trace to caller
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.code = opts.code;
    this.status = opts.status;

    if (opts.details) {
      this.details = opts.details;
    }
  }
}
