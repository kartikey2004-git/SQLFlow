class ApiError extends Error {
  public statusCode: number;
  public data: null;
  public message: string;
  public success: boolean;
  public errors: any[];

  constructor(
    statusCode: number,
    message: string = "Something went wrong",
    errors: any[] = [],
    stack: string = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    // This checks whether the stack variable has a value (it’s truthy).
    // This is typically done to see if a stack trace has already been provided, such as when you're manually passing a stack trace to a custom error object.

    if (stack) {
      this.stack = stack;
    }

    // If the stack variable is falsy (i.e., it's null, undefined, or some other falsy value), then it falls back to automatically generating the stack trace.
    else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
                                      