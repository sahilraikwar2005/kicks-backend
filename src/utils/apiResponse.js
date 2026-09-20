export function apiSuccess(message = 'Request successful', data = null, statusCode = 200) {
  return {
    success: true,
    message,
    data,
    statusCode,
  };
}

export function apiError(message = 'Something went wrong', errors = [], statusCode = 400) {
  return {
    success: false,
    message,
    errors,
    statusCode,
  };
}
