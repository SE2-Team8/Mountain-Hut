function responseSuccess(res, data = null, message = "", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data: data,
    message: message
  });
};

function responseError(res, data = null, message = "Error", statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    data: data,
    message: message
  });
};

export { responseSuccess, responseError }