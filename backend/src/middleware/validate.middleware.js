const AppError = require("../utils/appError");

const validateBody = (schemaFn) => {
  return (req, res, next) => {
    const errors = schemaFn(req.body);
    if (errors) {
      return next(new AppError(`Validation error: ${errors.join(" | ")}`, 400));
    }
    next();
  };
};

module.exports = {
  validateBody,
};
