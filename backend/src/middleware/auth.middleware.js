const jwt = require("jsonwebtoken");
const { userRepository } = require("../repositories");
const env = require("../config/env");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { readTokenFromCookies } = require("../utils/cookies");

const protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Prefer the httpOnly cookie (XSS-safe); fall back to the Bearer header
  //    so non-browser API clients keep working.
  token = readTokenFromCookies(req);
  if (
    !token &&
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to gain access.", 401)
    );
  }

  // 2) Validate token signature
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return next(new AppError("Invalid security token. Please log in again.", 401));
  }

  // 3) Check if user still exists
  const user = await userRepository.findById(decoded.id);

  if (!user) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401)
    );
  }

  // Grant Access
  req.user = user;
  next();
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo,
};
