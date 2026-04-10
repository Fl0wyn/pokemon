import jwt from "jsonwebtoken";
import { User } from "../models/User";

export function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET || process.env.JWTSECRET;
  if (!jwtSecret) {
    throw new Error(
      "JWT_SECRET or JWTSECRET environment variable is required",
    );
  }
  return jwtSecret;
}

/** Ensures a game user exists (default rank: user). */
export async function findOrCreateUserByEmail(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  let user = await User.findOne({ email }).exec();
  if (!user) {
    user = new User({ email });
    await user.save();
  }
}

export function signToolboxJwt(rawEmail: string): { token: string; email: string } {
  const email = rawEmail.toLowerCase().trim();
  const jwtSecret = getJwtSecret();
  return {
    token:
      "JWT " +
      jwt.sign({ userEmail: email }, jwtSecret, {
        expiresIn: 604800,
      }),
    email,
  };
}
