const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const env = require("../config/env");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { setAuthCookie, clearAuthCookie } = require("../utils/cookies");

const signToken = (id) => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

// A pre-computed bcrypt hash of a random string. When a login is attempted for
// an email that does not exist, we still run a comparison against this dummy so
// the response time is indistinguishable from a wrong-password attempt. This
// removes the timing side channel that would otherwise let an attacker
// enumerate which email addresses are registered.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO.Vp9m9m4Zr1lJj0m2v0mQ9mE8xZ8yQK";

const register = catchAsync(async (req, res, next) => {
  // NOTE: `role` is intentionally NOT read from the request body. Public
  // self-service registration always creates a "customer"; the client cannot
  // elevate its own privileges (prevents mass-assignment / privilege escalation).
  // Elevated roles are granted only by an admin flow or DB seeding.
  const { name, email, password } = req.body;

  // 1) Verify email uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return next(new AppError("Email address already registered.", 400));
  }

  // 2) Hash the password. Cost factor 12 raises the per-guess cost for an
  //    offline cracker; bcrypt stores the cost in the hash, so previously
  //    hashed (cost-10) passwords still verify unchanged.
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // 3) Create user
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "customer",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // 4) Generate token — delivered as an httpOnly cookie (XSS-safe). Still
  //    returned in the body for backward compatibility with API clients.
  const token = signToken(newUser.id);
  setAuthCookie(res, token);

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

  // Always perform a bcrypt comparison (against a dummy hash when the user is
  // absent) so success and failure paths take the same time — no user
  // enumeration via timing.
  const passwordOk = await bcrypt.compare(
    password,
    user ? user.password : DUMMY_HASH
  );

  if (!user || !passwordOk) {
    return next(new AppError("Incorrect email address or password.", 401));
  }

  // 2) Generate token — set as httpOnly cookie and also return in the body.
  const token = signToken(user.id);
  setAuthCookie(res, token);

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

const logout = catchAsync(async (req, res, next) => {
  // Clear the auth cookie so the session cannot be reused from the browser.
  clearAuthCookie(res);
  res.status(200).json({ status: "success", message: "Logged out." });
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
  logout,
  getMe,
};
