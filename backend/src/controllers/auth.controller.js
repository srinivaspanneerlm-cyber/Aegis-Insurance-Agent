const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

const register = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // 1) Verify email uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return next(new AppError("Email address already registered.", 400));
  }

  // 2) Hash security password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // 3) Create user
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role || "customer",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // 4) Generate token
  const token = signToken(newUser.id);

  res.status(201).json({
    status: "success",
    token,
    data: {
      user: newUser,
    },
  });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Fetch user including password
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AppError("Incorrect email address or password.", 401));
  }

  // 2) Generate token
  const token = signToken(user.id);

  // Remove password from payload
  const { password: _, ...userWithoutPassword } = user;

  res.status(200).json({
    status: "success",
    token,
    data: {
      user: userWithoutPassword,
    },
  });
});

const getMe = catchAsync(async (req, res, next) => {
  // req.user has already been verified and injected by protect middleware
  const { password: _, ...userWithoutPassword } = req.user;

  res.status(200).json({
    status: "success",
    data: {
      user: userWithoutPassword,
    },
  });
});

module.exports = {
  register,
  login,
  getMe,
};
