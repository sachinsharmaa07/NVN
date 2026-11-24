import { toPublicUser, withGeoNames, updateOwnProfile } from "../services/userService.js";

/** req.user was loaded (and created on first sight) by loadUser, so there is nothing to sync here. */
export async function getMe(req, res) {
  res.json({ user: await withGeoNames(toPublicUser(req.user)) });
}

export async function patchMe(req, res) {
  // Only req.user.id picks the row: there is no :id param, so nobody can edit someone else here.
  const changes = await updateOwnProfile(req.user.id, req.valid.body);
  res.json({ user: await withGeoNames(toPublicUser({ ...req.user, ...changes })) });
}
