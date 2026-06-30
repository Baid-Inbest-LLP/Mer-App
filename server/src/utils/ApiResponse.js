export class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200, meta = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static created(res, data, message = 'Created successfully') {
    return this.success(res, data, message, 201);
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
    });
  }

  static error(res, message = 'Something went wrong', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }
}
