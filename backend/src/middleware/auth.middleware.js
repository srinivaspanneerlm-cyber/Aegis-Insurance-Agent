const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Obtain token from Authorization header
  if (
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
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError("Invalid security token. Please log in again.", 401));
  }

  // 3) Check if user still exists
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

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
