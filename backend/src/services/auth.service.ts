import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { userRepository } from "../repositories";
import env from "../config/env";
import { AUTH } from "../config/constants";
import AppError from "../utils/appError";
import { audit } from "../config/logger";

const signToken = (id: string): string =>
  jwt.sign({ id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

// Pre-computed bcrypt hash of a random string. A login for a non-existent email
// still runs a comparison against this dummy so success/failure take the same
// time — removing the user-enumeration timing side channel.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO.Vp9m9m4Zr1lJj0m2v0mQ9mE8xZ8yQK";

// Fields returned to clients on register (never the password hash).
const PUBLIC_USER_SELECT = { id: true, name: true, email: true, role: true, createdAt: true };

export const authService = {
  /**
   * Public self-service registration. `role` is intentionally never read from
   * input — it is always "customer" (no privilege escalation via mass-assignment).
   * Returns the created user + a signed token; the caller sets the cookie.
   */
  async register(input: { name: string; email: string; password: string }) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new AppError("Email address already registered.", 400);

    const hashedPassword = await bcrypt.hash(input.password, AUTH.BCRYPT_ROUNDS);
    const user = await userRepository.create(
      { name: input.name, email: input.email, password: hashedPassword, role: "customer" },
      { select: PUBLIC_USER_SELECT }
    );

    const token = signToken(user.id);
    audit.info({ event: "register", userId: user.id, email: input.email }, "account registered");
    return { user, token };
  },

  async login(input: { email: string; password: string }) {
    const user = await userRepository.findByEmail(input.email);

    // Constant-time-ish: always run bcrypt (dummy hash when the user is absent).
    const passwordOk = await bcrypt.compare(input.password, user ? user.password : DUMMY_HASH);

    if (!user || !passwordOk) {
      audit.warn({ event: "login.failure", email: input.email }, "login failed");
      throw new AppError("Incorrect email address or password.", 401);
    }

    const token = signToken(user.id);
    audit.info({ event: "login.success", userId: user.id }, "login succeeded");

    const { password: _pw, ...userWithoutPassword } = user;
    void _pw;
    return { user: userWithoutPassword, token };
  },
};
