import { resendVerificationEmail } from "../services/authProviderService.js";
import {
  assertActive,
  findByAuth0Id,
  readClaims,
  syncFromToken,
  toPublicUser,
  toRequestUser,
} from "../services/userService.js";
import { AppError } from "../utils/AppError.js";

/** The first call after sign-in creates the citizen record; later calls refresh it. */
export async function getMe(req, res) {
  const claims = readClaims(req.auth.payload);
  // A suspended account is turned away before we write anything to its record.
  const existing = await findByAuth0Id(claims.auth0Id);
  if (existing) assertActive(existing);
  const record = await syncFromToken(claims);
  res.json({ user: toPublicUser(toRequestUser(record, claims)) });
}

export async function resendVerification(req, res) {
  if (req.user.emailVerified) {
    throw new AppError("ALREADY_VERIFIED", 409, "Your email is already verified.");
  }
  await resendVerificationEmail(req.user.auth0Id);
  res.status(202).json({ sent: true });
}
