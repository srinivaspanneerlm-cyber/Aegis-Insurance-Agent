const AppError = require("../utils/appError");

const handlePrismaUniqueConstraintError = (err) => {
  const target = err.meta?.target ? err.meta.target.join(", ") : "field";
  return new AppError(`Duplicate value for target: ${target}. Please use another value.`, 400);
};

const handlePrismaValidationError = (err) => {
  return new AppError(`Invalid database transaction parameter: ${err.message}`, 400);
};

const sendErrorDev = (err, req, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak details
    console.error("ERROR 💥", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong on our end.",
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res);
  } else {
    let error = Object.assign(err);
    error.message = err.message;

    if (err.code === "P2002") error = handlePrismaUniqueConstraintError(error);
    if (err.name === "PrismaClientValidationError") error = handlePrismaValidationError(error);
    if (err.name === "JsonWebTokenError") error = new AppError("Invalid security token. Please log in again.", 401);
    if (err.name === "TokenExpiredError") error = new AppError("Your security token has expired. Please log in again.", 401);

    sendErrorProd(error, req, res);
  }
};
