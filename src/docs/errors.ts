export function listErrors() {
  return {
    400: {
      description:
        "Bad Request : The request data is invalid or missing fields",
    },
    401: {
      description:
        "Unauthorized : Authentication is required or token is invalid",
    },
    403: {
      description:
        "Forbidden : You don’t have permission to access this resource",
    },
    404: {
      description: "Not Found : The requested resource could not be found",
    },
    409: {
      description: "Conflict : Resource already exists or constraint violation",
    },
    500: {
      description: "Internal Server Error : Something went wrong on the server",
    },
  };
}
